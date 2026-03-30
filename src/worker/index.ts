/**
 * Background worker process.
 * Polls the job queue and processes CRAWL_SITE and CHECK_DOMAIN jobs
 * with configurable concurrency.
 */
import { prisma, enableWAL } from '../lib/db'
import { claimNextJob, markJobDone, markJobFailed, isSystemPaused } from '../lib/worker/queue'
import { processCrawlSite } from '../lib/worker/crawl-job'
import { processCheckDomain } from '../lib/worker/domain-job'
import { globalLogger as log } from '../lib/logger'
import type { CrawlSitePayload, CheckDomainPayload } from '../lib/types'

const CRAWL_CONCURRENCY = Number(process.env.WORKER_CRAWL_CONCURRENCY ?? 3)
const DOMAIN_CHECK_CONCURRENCY = Number(process.env.WORKER_DOMAIN_CHECK_CONCURRENCY ?? 10)
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2_000)

let activeCrawls = 0
let activeChecks = 0
let running = true

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function runLoop() {
  await enableWAL()
  await log.info(`Worker started (PID=${process.pid}, crawl_concurrency=${CRAWL_CONCURRENCY}, check_concurrency=${DOMAIN_CHECK_CONCURRENCY})`)

  // Mark worker as running
  await prisma.appSetting.upsert({
    where: { key: 'worker_running' },
    create: { key: 'worker_running', value: 'true' },
    update: { value: 'true' },
  })

  while (running) {
    try {
      const paused = await isSystemPaused()
      if (paused) {
        await sleep(POLL_INTERVAL_MS)
        continue
      }

      let didWork = false

      // ── Pick up CRAWL_SITE jobs ─────────────────────────────────────────────
      while (activeCrawls < CRAWL_CONCURRENCY) {
        const job = await claimNextJob('CRAWL_SITE')
        if (!job) break
        didWork = true
        activeCrawls++
        const jobId = job.id
        const payload = job.payload as CrawlSitePayload

        processCrawlSite(payload)
          .then(() => markJobDone(jobId))
          .catch(err => markJobFailed(jobId, err))
          .finally(() => { activeCrawls-- })
      }

      // ── Pick up CHECK_DOMAIN jobs ───────────────────────────────────────────
      while (activeChecks < DOMAIN_CHECK_CONCURRENCY) {
        const job = await claimNextJob('CHECK_DOMAIN')
        if (!job) break
        didWork = true
        activeChecks++
        const jobId = job.id
        const payload = job.payload as CheckDomainPayload

        processCheckDomain(payload)
          .then(() => markJobDone(jobId))
          .catch(err => markJobFailed(jobId, err))
          .finally(() => { activeChecks-- })
      }

      if (!didWork) {
        await sleep(POLL_INTERVAL_MS)
      }
    } catch (err) {
      await log.error(`Worker loop error: ${err instanceof Error ? err.message : String(err)}`)
      await sleep(5_000)
    }
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  await log.info(`Worker shutting down (${signal})`)
  running = false
  await prisma.appSetting.upsert({
    where: { key: 'worker_running' },
    create: { key: 'worker_running', value: 'false' },
    update: { value: 'false' },
  })
  // Give active jobs 10s to finish
  let waited = 0
  while ((activeCrawls > 0 || activeChecks > 0) && waited < 10_000) {
    await sleep(500)
    waited += 500
  }
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

runLoop().catch(async (err) => {
  await log.error(`Fatal worker error: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
