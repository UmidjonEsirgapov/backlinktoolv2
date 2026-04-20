import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cancelSiteJobs } from '@/lib/worker/queue'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const site = await prisma.site.findUnique({
    where: { id: params.id },
    include: {
      siteExternalDomains: {
        include: { externalDomain: true },
        orderBy: { frequency: 'desc' },
        take: 200,
      },
      _count: { select: { pages: true, logs: true } },
    },
  })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(site)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { status } = body
  const allowed = ['QUEUED', 'PAUSED', 'SKIPPED']
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${allowed.join(', ')}` }, { status: 400 })
  }
  const site = await prisma.site.update({
    where: { id: params.id },
    data: { status },
  })
  return NextResponse.json(site)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.site.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await cancelSiteJobs(params.id)
  await prisma.site.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
