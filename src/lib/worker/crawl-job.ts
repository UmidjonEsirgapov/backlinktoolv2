import { prisma } from '../db'
import { crawlSite } from '../crawler/engine'
import { Logger } from '../logger'
import { isUzDomain } from '../crawler/normalizer'
import { enqueueJob } from './queue'
import type { CrawlSitePayload } from '../types'

export async function processCrawlSite(payload: CrawlSitePayload): Promise<void> {
  const { siteId, domain } = payload
  const log = new Logger(siteId)

  // Verify site exists and is in a startable state
  const site = await prisma.site.findUnique({ where: { id: siteId } })
  if (!site) {
    throw new Error(`Site ${siteId} not found`)
  }
  if (site.status === 'DONE') {
    await log.info(`Site ${domain} already done, skipping`)
    return
  }
  if (site.status === 'PAUSED' || site.status === 'SKIPPED') {
    await log.info(`Site ${domain} is ${site.status}, skipping`)
    return
  }

  await log.info(`Starting crawl for ${domain}`)

  try {
    await crawlSite(siteId, domain, log)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await log.error(`Crawl failed for ${domain}: ${errMsg}`, { error: errMsg })
    await prisma.site.update({
      where: { id: siteId },
      data: { status: 'ERROR', errorMsg: errMsg },
    })
    throw err
  }

  // After crawl: enqueue CHECK_DOMAIN jobs for all .uz domains
  await enqueueDomainChecks(siteId, log)
}

async function enqueueDomainChecks(siteId: string, log: Logger) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { siteExternalDomains: { include: { externalDomain: true } } },
  })
  if (!site) return

  let queued = 0
  for (const sed of site.siteExternalDomains) {
    const { externalDomain } = sed
    if (!isUzDomain(externalDomain.domain)) continue
    // Only check if not already checked recently
    if (externalDomain.saleStatus !== 'UNKNOWN' && externalDomain.lastChecked) {
      const hoursSince =
        (Date.now() - externalDomain.lastChecked.getTime()) / (1_000 * 60 * 60)
      if (hoursSince < 24) continue
    }
    if (externalDomain.saleStatus === 'CHECKING') continue

    // Mark as checking
    await prisma.externalDomain.update({
      where: { id: externalDomain.id },
      data: { saleStatus: 'CHECKING' },
    })

    await enqueueJob(
      'CHECK_DOMAIN',
      { domainId: externalDomain.id, domain: externalDomain.domain },
      { priority: 0 },
    )
    queued++
  }

  if (queued > 0) {
    await log.info(`Queued ${queued} .uz domain checks for ${site.domain}`)
  }
}
