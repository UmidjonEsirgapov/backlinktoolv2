import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(200, Number(searchParams.get('limit') ?? 100))
  const level = searchParams.get('level')

  const logs = await prisma.crawlLog.findMany({
    where: {
      siteId: params.id,
      ...(level ? { level } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json(logs)
}
