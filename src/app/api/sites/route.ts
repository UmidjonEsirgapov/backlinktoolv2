import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))
  const search = searchParams.get('q') ?? ''

  const where = {
    ...(status ? { status } : {}),
    ...(search ? { domain: { contains: search } } : {}),
  }

  const [sites, total] = await Promise.all([
    prisma.site.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { siteExternalDomains: true } },
      },
    }),
    prisma.site.count({ where }),
  ])

  return NextResponse.json({ sites, total, page, limit })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const domains: string[] = body.domains ?? []

  if (!Array.isArray(domains) || domains.length === 0) {
    return NextResponse.json({ error: 'domains array required' }, { status: 400 })
  }

  const cleaned = [...new Set(
    domains
      .map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''))
      .filter(d => d.length > 0),
  )]

  // Upsert sites (skip existing)
  let created = 0
  let skipped = 0
  for (const domain of cleaned) {
    const existing = await prisma.site.findUnique({ where: { domain } })
    if (existing) { skipped++; continue }
    await prisma.site.create({ data: { domain } })
    created++
  }

  return NextResponse.json({ created, skipped, total: cleaned.length })
}
