import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { DashboardStats } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [
      sites,
      totalPagesCrawled,
      totalExternalDomains,
      totalUzDomains,
      totalForSale,
      totalAvailable,
      totalErrors,
      recentLogs,
      workerSetting,
      pausedSetting,
    ] = await Promise.all([
      prisma.site.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.page.count({ where: { status: 'CRAWLED' } }),
      prisma.externalDomain.count(),
      prisma.externalDomain.count({ where: { isUz: true } }),
      prisma.externalDomain.count({ where: { saleStatus: 'FOR_SALE' } }),
      prisma.externalDomain.count({ where: { saleStatus: 'AVAILABLE' } }),
      prisma.site.count({ where: { status: 'ERROR' } }),
      prisma.crawlLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { site: { select: { domain: true } } },
      }),
      prisma.appSetting.findUnique({ where: { key: 'worker_running' } }),
      prisma.appSetting.findUnique({ where: { key: 'paused' } }),
    ])

    const totalSites = await prisma.site.count()

    const sitesByStatus = Object.fromEntries(
      sites.map(s => [s.status, s._count.id]),
    ) as DashboardStats['sitesByStatus']

    const stats: DashboardStats = {
      totalSites,
      sitesByStatus,
      totalPagesCrawled,
      totalExternalDomains,
      totalUzDomains,
      totalForSaleDomains: totalForSale,
      totalAvailableDomains: totalAvailable,
      totalErrors,
      recentLogs: recentLogs.map(l => ({
        id: l.id,
        siteId: l.siteId,
        siteDomain: l.site?.domain ?? null,
        level: l.level as DashboardStats['recentLogs'][0]['level'],
        message: l.message,
        meta: l.meta ? JSON.parse(l.meta) : undefined,
        createdAt: l.createdAt.toISOString(),
      })),
      workerRunning: workerSetting?.value === 'true',
      systemPaused: pausedSetting?.value === 'true',
    }

    return NextResponse.json(stats)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
