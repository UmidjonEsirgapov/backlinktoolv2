import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enqueueJob } from '@/lib/worker/queue'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const domain = await prisma.externalDomain.findUnique({ where: { id: params.id } })
  if (!domain) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.externalDomain.update({
    where: { id: params.id },
    data: { saleStatus: 'CHECKING' },
  })

  await enqueueJob(
    'CHECK_DOMAIN',
    { domainId: domain.id, domain: domain.domain },
    { priority: 10 }, // higher priority than regular checks
  )

  return NextResponse.json({ ok: true, queued: domain.domain })
}
