/**
 * Control API: start, pause, resume, stop crawling.
 * POST /api/control  { action: 'start' | 'pause' | 'resume' | 'stop' | 'recheck_uz' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enqueueJob, setSystemPaused, cancelSiteJobs } from '@/lib/worker/queue'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, siteId } = body as { action: string; siteId?: string }

  switch (action) {
    case 'start': {
      // Enqueue all QUEUED sites
      await setSystemPaused(false)
      const sites = await prisma.site.findMany({
        where: { status: { in: ['QUEUED', 'ERROR'] } },
        orderBy: { createdAt: 'asc' },
      })
      let queued = 0
      for (const site of sites) {
        // Check if there's already a pending job for this site
        const existing = await prisma.jobQueue.findFirst({
          where: {
            type: 'CRAWL_SITE',
            status: { in: ['PENDING', 'RUNNING'] },
            payload: { contains: site.id },
          },
        })
        if (existing) continue
        await enqueueJob('CRAWL_SITE', { siteId: site.id, domain: site.domain })
        await prisma.site.update({ where: { id: site.id }, data: { status: 'QUEUED' } })
        queued++
      }
      return NextResponse.json({ ok: true, queued })
    }

    case 'start_one': {
      if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 })
      await setSystemPaused(false)
      const site = await prisma.site.findUnique({ where: { id: siteId } })
      if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

      const existing = await prisma.jobQueue.findFirst({
        where: {
          type: 'CRAWL_SITE',
          status: { in: ['PENDING', 'RUNNING'] },
          payload: { contains: siteId },
        },
      })
      if (existing) return NextResponse.json({ ok: true, message: 'Already queued' })

      await enqueueJob('CRAWL_SITE', { siteId: site.id, domain: site.domain }, { priority: 5 })
      await prisma.site.update({ where: { id: siteId }, data: { status: 'QUEUED' } })
      return NextResponse.json({ ok: true })
    }

    case 'pause': {
      await setSystemPaused(true)
      // Mark all CRAWLING sites as PAUSED
      await prisma.site.updateMany({ where: { status: 'CRAWLING' }, data: { status: 'PAUSED' } })
      return NextResponse.json({ ok: true })
    }

    case 'resume': {
      await setSystemPaused(false)
      // Re-queue paused sites
      const paused = await prisma.site.findMany({ where: { status: 'PAUSED' } })
      for (const s of paused) {
        await prisma.site.update({ where: { id: s.id }, data: { status: 'QUEUED' } })
        await enqueueJob('CRAWL_SITE', { siteId: s.id, domain: s.domain })
      }
      return NextResponse.json({ ok: true, resumed: paused.length })
    }

    case 'stop_one': {
      if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 })
      await prisma.site.update({ where: { id: siteId }, data: { status: 'PAUSED' } })
      await cancelSiteJobs(siteId)
      return NextResponse.json({ ok: true })
    }

    case 'recheck_uz': {
      // Re-queue all .uz domains that haven't been checked or are unknown
      const domains = await prisma.externalDomain.findMany({
        where: { isUz: true, saleStatus: { in: ['UNKNOWN', 'ERROR'] } },
      })
      for (const d of domains) {
        await prisma.externalDomain.update({ where: { id: d.id }, data: { saleStatus: 'CHECKING' } })
        await enqueueJob('CHECK_DOMAIN', { domainId: d.id, domain: d.domain })
      }
      return NextResponse.json({ ok: true, queued: domains.length })
    }

    case 'reset_site': {
      if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 })
      await prisma.page.deleteMany({ where: { siteId } })
      await prisma.site.update({
        where: { id: siteId },
        data: {
          status: 'QUEUED',
          pagesCrawled: 0,
          pagesError: 0,
          pagesQueued: 0,
          externalLinksFound: 0,
          uzDomainsFound: 0,
          errorMsg: null,
          crawlStoppedReason: null,
          startedAt: null,
          completedAt: null,
        },
      })
      await cancelSiteJobs(siteId)
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
