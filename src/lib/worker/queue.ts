/**
 * DB-backed job queue — no Redis needed.
 * Uses SQLite row locking via UPDATE WHERE status='PENDING' to claim jobs.
 */
import { prisma } from '../db'
import type { JobType, JobStatus, CrawlSitePayload, CheckDomainPayload } from '../types'

export interface Job {
  id: string
  type: JobType
  payload: CrawlSitePayload | CheckDomainPayload
  attempts: number
  maxAttempts: number
}

const WORKER_KEY = `worker-${process.pid}-${Date.now()}`

/** Claim the next available job atomically */
export async function claimNextJob(type?: JobType): Promise<Job | null> {
  // Recover stale RUNNING jobs (worker crashed while processing)
  const staleMs = Number(process.env.JOB_STALE_AFTER_MS ?? 10 * 60 * 1_000)
  const staleThreshold = new Date(Date.now() - staleMs)
  await prisma.jobQueue.updateMany({
    where: {
      status: 'RUNNING',
      startedAt: { lt: staleThreshold },
    },
    data: { status: 'PENDING', workerKey: null, startedAt: null },
  })

  // Find + claim next pending job
  const where = {
    status: 'PENDING' as JobStatus,
    scheduledAt: { lte: new Date() },
    ...(type ? { type } : {}),
  }

  const job = await prisma.jobQueue.findFirst({
    where,
    orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
  })

  if (!job) return null

  // Claim it (may fail silently if another worker grabbed it first — that's fine)
  const claimed = await prisma.jobQueue.updateMany({
    where: { id: job.id, status: 'PENDING' },
    data: { status: 'RUNNING', workerKey: WORKER_KEY, startedAt: new Date() },
  })

  if (claimed.count === 0) return null // race condition — another worker got it

  return {
    id: job.id,
    type: job.type as JobType,
    payload: JSON.parse(job.payload),
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
  }
}

export async function markJobDone(jobId: string) {
  await prisma.jobQueue.update({
    where: { id: jobId },
    data: { status: 'DONE', completedAt: new Date() },
  })
}

export async function markJobFailed(jobId: string, error: unknown) {
  const job = await prisma.jobQueue.findUnique({ where: { id: jobId } })
  if (!job) return

  const errMsg = error instanceof Error ? error.message : String(error)
  const newAttempts = job.attempts + 1
  const shouldRetry = newAttempts < job.maxAttempts

  await prisma.jobQueue.update({
    where: { id: jobId },
    data: {
      status: shouldRetry ? 'PENDING' : 'FAILED',
      attempts: newAttempts,
      errorMsg: errMsg,
      workerKey: null,
      startedAt: null,
      // Backoff: retry after 30s * attempts
      scheduledAt: shouldRetry ? new Date(Date.now() + 30_000 * newAttempts) : undefined,
    },
  })
}

export async function enqueueJob(
  type: JobType,
  payload: CrawlSitePayload | CheckDomainPayload,
  opts: { priority?: number; maxAttempts?: number } = {},
) {
  await prisma.jobQueue.create({
    data: {
      type,
      payload: JSON.stringify(payload),
      priority: opts.priority ?? 0,
      maxAttempts: opts.maxAttempts ?? 3,
    },
  })
}

export async function cancelSiteJobs(siteId: string) {
  // Cancel any pending CRAWL_SITE jobs for this site
  const jobs = await prisma.jobQueue.findMany({
    where: { type: 'CRAWL_SITE', status: { in: ['PENDING', 'RUNNING'] } },
  })
  for (const job of jobs) {
    const payload = JSON.parse(job.payload) as CrawlSitePayload
    if (payload.siteId === siteId) {
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: { status: 'CANCELLED' },
      })
    }
  }
}

export async function isSystemPaused(): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'paused' } })
  return setting?.value === 'true'
}

export async function setSystemPaused(paused: boolean) {
  await prisma.appSetting.upsert({
    where: { key: 'paused' },
    create: { key: 'paused', value: paused ? 'true' : 'false' },
    update: { value: paused ? 'true' : 'false' },
  })
}
