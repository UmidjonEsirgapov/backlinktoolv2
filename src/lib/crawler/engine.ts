/**
 * Core crawl engine for a single site.
 * BFS traversal respecting depth/page limits, robots.txt, and deduplication.
 */
import { prisma } from '../db'
import { fetchPage } from './fetcher'
import { getRobotRules, isAllowed, getSitemapUrls } from './robots'
import { parseHtml, parseSitemap } from './parser'
import { normalizeUrl, extractRegisteredDomain, isSameDomain, isUzDomain } from './normalizer'
import { CRAWLER_DEFAULTS, ASSET_EXTENSIONS } from '../constants'
import type { Logger } from '../logger'

export interface EngineConfig {
  maxDepth: number
  maxPages: number
  pageConcurrency: number
  requestTimeoutMs: number
  rateLimitMs: number
}

function getConfig(): EngineConfig {
  return {
    maxDepth: Number(process.env.CRAWLER_MAX_DEPTH ?? CRAWLER_DEFAULTS.MAX_DEPTH),
    maxPages: Number(process.env.CRAWLER_MAX_PAGES_PER_SITE ?? CRAWLER_DEFAULTS.MAX_PAGES_PER_SITE),
    pageConcurrency: Number(process.env.CRAWLER_PAGE_CONCURRENCY ?? CRAWLER_DEFAULTS.PAGE_CONCURRENCY),
    requestTimeoutMs: Number(process.env.CRAWLER_REQUEST_TIMEOUT_MS ?? CRAWLER_DEFAULTS.REQUEST_TIMEOUT_MS),
    rateLimitMs: Number(process.env.CRAWLER_RATE_LIMIT_MS ?? CRAWLER_DEFAULTS.RATE_LIMIT_MS),
  }
}

interface QueueItem {
  url: string
  normalizedUrl: string
  depth: number
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

/** Run a concurrency-limited pool over items */
async function pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!
      await fn(item)
    }
  })
  await Promise.all(workers)
}

export async function crawlSite(siteId: string, domain: string, log: Logger): Promise<void> {
  const cfg = getConfig()
  const baseUrl = `https://${domain}`
  const registeredDomain = extractRegisteredDomain(baseUrl) ?? domain

  // ── Robots.txt ─────────────────────────────────────────────────────────────
  await log.info(`Fetching robots.txt for ${domain}`)
  const robots = await getRobotRules(baseUrl)
  let sitemapUrls = getSitemapUrls(robots)

  // ── Discover sitemaps ──────────────────────────────────────────────────────
  const defaultSitemaps = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap-index.xml`,
    `${baseUrl}/sitemap/sitemap.xml`,
  ]
  const sitemapsToTry = [
    ...new Set([...sitemapUrls, ...defaultSitemaps]),
  ]

  const sitemapDiscoveredUrls: string[] = []
  for (const sitemapUrl of sitemapsToTry) {
    const res = await fetchPage(sitemapUrl, { timeoutMs: 10_000 })
    if (res.statusCode === 200 && res.body) {
      const urls = parseSitemap(res.body)
      if (urls.length > 0) {
        await log.info(`Sitemap ${sitemapUrl}: ${urls.length} URLs`)
        sitemapDiscoveredUrls.push(...urls)
        break // use first successful sitemap
      }
    }
  }

  // ── Initialize BFS queue ───────────────────────────────────────────────────
  // Seed with home page + sitemap URLs (limited)
  const seedUrls = [
    baseUrl,
    ...sitemapDiscoveredUrls.slice(0, cfg.maxPages),
  ]

  const visitedNormalized = new Set<string>()
  const bfsQueue: QueueItem[] = []

  for (const u of seedUrls) {
    const n = normalizeUrl(u)
    if (n && !visitedNormalized.has(n) && isSameDomain(n, registeredDomain)) {
      visitedNormalized.add(n)
      bfsQueue.push({ url: u, normalizedUrl: n, depth: 0 })
    }
  }

  // Restore already-crawled pages from DB (for resume support)
  const existingPages = await prisma.page.findMany({
    where: { siteId },
    select: { normalizedUrl: true, status: true },
  })
  for (const p of existingPages) {
    visitedNormalized.add(p.normalizedUrl)
  }

  // Seed DB with initial pages
  await prisma.site.update({
    where: { id: siteId },
    data: { pagesQueued: bfsQueue.length, status: 'CRAWLING', startedAt: new Date() },
  })

  let pagesCrawled = 0
  let pagesError = 0
  const externalDomainFreq = new Map<string, number>()

  // ── BFS main loop ──────────────────────────────────────────────────────────
  while (bfsQueue.length > 0 && pagesCrawled < cfg.maxPages) {
    // Check if site was paused/cancelled externally
    const siteStatus = await prisma.site.findUnique({
      where: { id: siteId },
      select: { status: true },
    })
    if (siteStatus?.status === 'PAUSED' || siteStatus?.status === 'SKIPPED') {
      await log.info(`Site ${domain} crawl paused/cancelled at page ${pagesCrawled}`)
      return
    }

    // Take a batch from BFS queue
    const batch = bfsQueue.splice(0, cfg.pageConcurrency)
    const nextLinks: QueueItem[] = []

    await pool(batch, cfg.pageConcurrency, async (item) => {
      // Create or find page record
      let pageRecord = await prisma.page.findUnique({
        where: { siteId_normalizedUrl: { siteId, normalizedUrl: item.normalizedUrl } },
      })
      if (!pageRecord) {
        pageRecord = await prisma.page.create({
          data: {
            siteId,
            url: item.url,
            normalizedUrl: item.normalizedUrl,
            depth: item.depth,
            status: 'PENDING',
          },
        })
      }
      // Skip if already crawled
      if (pageRecord.status === 'CRAWLED') return

      // Check robots.txt
      if (!isAllowed(robots, item.url)) {
        await prisma.page.update({
          where: { id: pageRecord.id },
          data: { status: 'SKIPPED', errorMsg: 'Disallowed by robots.txt' },
        })
        return
      }

      await sleep(cfg.rateLimitMs)

      const res = await fetchPage(item.url, {
        timeoutMs: cfg.requestTimeoutMs,
      })

      if (res.error || res.statusCode === 0) {
        pagesError++
        await prisma.page.update({
          where: { id: pageRecord.id },
          data: {
            status: 'ERROR',
            statusCode: res.statusCode,
            errorMsg: res.error ?? 'Unknown error',
            crawledAt: new Date(),
          },
        })
        await log.warn(`Error fetching ${item.url}: ${res.error}`, { url: item.url })
        return
      }

      // Handle redirects that leave the domain
      if (res.finalUrl && !isSameDomain(res.finalUrl, registeredDomain)) {
        await prisma.page.update({
          where: { id: pageRecord.id },
          data: {
            status: 'SKIPPED',
            statusCode: res.statusCode,
            redirectTo: res.finalUrl,
            crawledAt: new Date(),
          },
        })
        return
      }

      // Parse HTML
      const parsed = parseHtml(res.body, res.finalUrl)

      // ── Handle canonical redirect ──────────────────────────────────────────
      const effectiveUrl = parsed.canonicalUrl ?? res.finalUrl

      // ── Process extracted links ────────────────────────────────────────────
      for (const link of parsed.links) {
        if (link.type === 'MAILTO' || link.type === 'TEL' || link.type === 'JAVASCRIPT') continue
        if (link.type === 'ASSET') continue

        const linkDomain = extractRegisteredDomain(link.href)
        if (!linkDomain) continue

        if (linkDomain === registeredDomain || isSameDomain(link.href, registeredDomain)) {
          // Internal link — add to BFS queue if within depth limit
          if (item.depth < cfg.maxDepth && !visitedNormalized.has(link.href)) {
            visitedNormalized.add(link.href)
            nextLinks.push({ url: link.href, normalizedUrl: link.href, depth: item.depth + 1 })
          }
        } else {
          // External link — record it
          const freq = externalDomainFreq.get(linkDomain) ?? 0
          externalDomainFreq.set(linkDomain, freq + 1)

          // Upsert (parallel sahifalar bir vaqtda bir xil domenni yozganda find+create unique xato berardi)
          const extDomain = await prisma.externalDomain.upsert({
            where: { domain: linkDomain },
            create: { domain: linkDomain, isUz: isUzDomain(linkDomain) },
            update: { isUz: isUzDomain(linkDomain) },
          })

          await prisma.siteExternalDomain.upsert({
            where: {
              siteId_externalDomainId: { siteId, externalDomainId: extDomain.id },
            },
            create: { siteId, externalDomainId: extDomain.id, frequency: 1 },
            update: { frequency: { increment: 1 } },
          })

          // Save the actual link
          const isNofollow = link.rel.includes('nofollow')
          if (!isNofollow || true) { // save all for analysis
            await prisma.domainLink.create({
              data: {
                externalDomainId: extDomain.id,
                sourcePageUrl: effectiveUrl.slice(0, 1000),
                targetUrl: link.href.slice(0, 1000),
                anchor: link.anchor.slice(0, 300),
                rel: link.rel.slice(0, 100),
                linkType: link.type,
              },
            })
          }
        }
      }

      pagesCrawled++
      await prisma.page.update({
        where: { id: pageRecord.id },
        data: {
          status: 'CRAWLED',
          statusCode: res.statusCode,
          redirectTo: res.finalUrl !== item.url ? res.finalUrl : null,
          crawledAt: new Date(),
        },
      })

      // Periodic progress update
      if (pagesCrawled % 10 === 0) {
        await prisma.site.update({
          where: { id: siteId },
          data: {
            pagesCrawled,
            pagesError,
            externalLinksFound: externalDomainFreq.size,
            uzDomainsFound: [...externalDomainFreq.keys()].filter(isUzDomain).length,
          },
        })
        await log.info(`${domain}: crawled ${pagesCrawled} pages, ${externalDomainFreq.size} external domains`)
      }
    })

    // URLs are already marked in visitedNormalized when queued into nextLinks; do not skip here
    // or the BFS queue never grows beyond the seed (only home page gets crawled).
    for (const l of nextLinks) {
      bfsQueue.push(l)
    }

    await prisma.site.update({
      where: { id: siteId },
      data: { pagesQueued: bfsQueue.length + pagesCrawled },
    })
  }

  // ── Final update ───────────────────────────────────────────────────────────
  const uzDomains = [...externalDomainFreq.keys()].filter(isUzDomain)
  await prisma.site.update({
    where: { id: siteId },
    data: {
      status: 'DONE',
      pagesCrawled,
      pagesError,
      externalLinksFound: externalDomainFreq.size,
      uzDomainsFound: uzDomains.length,
      completedAt: new Date(),
    },
  })

  await log.info(
    `Completed ${domain}: ${pagesCrawled} pages, ${externalDomainFreq.size} external domains, ${uzDomains.length} .uz domains`,
  )
}
