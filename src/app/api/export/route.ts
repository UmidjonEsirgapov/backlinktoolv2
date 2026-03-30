import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'json' // json | csv
  const type = searchParams.get('type') ?? 'domains' // domains | sites | sale
  const uzOnly = searchParams.get('uz') === '1'

  if (type === 'sale' || type === 'domains') {
    const where = {
      ...(uzOnly || type === 'sale' ? { isUz: true } : {}),
      ...(type === 'sale' ? { saleStatus: { in: ['FOR_SALE', 'AVAILABLE'] } } : {}),
    }

    const domains = await prisma.externalDomain.findMany({
      where,
      orderBy: [{ saleStatus: 'asc' }, { domain: 'asc' }],
      include: {
        siteExternalDomains: {
          include: { site: { select: { domain: true } } },
          take: 10,
        },
      },
    })

    const rows = domains.map(d => ({
      domain: d.domain,
      isUz: d.isUz,
      saleStatus: d.saleStatus,
      dnsResolved: d.dnsResolved,
      httpStatus: d.httpStatus,
      evidence: d.evidence ? JSON.parse(d.evidence).join(' | ') : '',
      daScore: d.daScore ?? '',
      lastChecked: d.lastChecked?.toISOString() ?? '',
      sourceSites: d.siteExternalDomains.map(s => s.site.domain).join(', '),
    }))

    if (format === 'csv') {
      const headers = Object.keys(rows[0] ?? {})
      const csv = [
        headers.join(','),
        ...rows.map(r =>
          headers.map(h => `"${String(r[h as keyof typeof r]).replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="domains-${type}-${Date.now()}.csv"`,
        },
      })
    }

    return NextResponse.json(rows)
  }

  if (type === 'sites') {
    const sites = await prisma.site.findMany({
      orderBy: { domain: 'asc' },
      include: { _count: { select: { siteExternalDomains: true } } },
    })

    const rows = sites.map(s => ({
      domain: s.domain,
      status: s.status,
      pagesCrawled: s.pagesCrawled,
      externalLinksFound: s.externalLinksFound,
      uzDomainsFound: s.uzDomainsFound,
      startedAt: s.startedAt?.toISOString() ?? '',
      completedAt: s.completedAt?.toISOString() ?? '',
    }))

    if (format === 'csv') {
      const headers = Object.keys(rows[0] ?? {})
      const csv = [
        headers.join(','),
        ...rows.map(r =>
          headers.map(h => `"${String(r[h as keyof typeof r]).replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="sites-${Date.now()}.csv"`,
        },
      })
    }

    return NextResponse.json(rows)
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
