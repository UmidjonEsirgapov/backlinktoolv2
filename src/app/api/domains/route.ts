import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 100)))
  const search = searchParams.get('q') ?? ''
  const status = searchParams.get('status') // FOR_SALE, AVAILABLE, NOT_FOR_SALE, UNKNOWN, CHECKING
  const uzOnly = searchParams.get('uz') === '1'
  const siteId = searchParams.get('siteId')

  const where = {
    ...(uzOnly ? { isUz: true } : {}),
    ...(status ? { saleStatus: status } : {}),
    ...(search ? { domain: { contains: search } } : {}),
    ...(siteId
      ? { siteExternalDomains: { some: { siteId } } }
      : {}),
  }

  const [domains, total] = await Promise.all([
    prisma.externalDomain.findMany({
      where,
      orderBy: [{ saleStatus: 'asc' }, { domain: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { siteExternalDomains: true, links: true } },
        siteExternalDomains: {
          take: 5,
          include: { site: { select: { domain: true } } },
        },
      },
    }),
    prisma.externalDomain.count({ where }),
  ])

  const enriched = domains.map(d => ({
    ...d,
    evidenceParsed: d.evidence ? JSON.parse(d.evidence) : [],
    sourceSites: d.siteExternalDomains.map(s => s.site.domain),
  }))

  return NextResponse.json({ domains: enriched, total, page, limit })
}
