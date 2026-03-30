// ─── Enums as string unions (mirrors Prisma string fields) ────────────────────

export type SiteStatus = 'QUEUED' | 'CRAWLING' | 'PAUSED' | 'DONE' | 'ERROR' | 'SKIPPED'
export type PageStatus = 'PENDING' | 'CRAWLED' | 'ERROR' | 'SKIPPED'
export type DomainSaleStatus = 'UNKNOWN' | 'CHECKING' | 'FOR_SALE' | 'NOT_FOR_SALE' | 'AVAILABLE' | 'ERROR'
export type JobType = 'CRAWL_SITE' | 'CHECK_DOMAIN'
export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED'
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
export type LinkType = 'EXTERNAL' | 'MAILTO' | 'TEL' | 'ASSET' | 'JAVASCRIPT' | 'OTHER'

// ─── Job payloads ──────────────────────────────────────────────────────────────

export interface CrawlSitePayload {
  siteId: string
  domain: string
}

export interface CheckDomainPayload {
  domainId: string
  domain: string
}

// ─── Domain check result ───────────────────────────────────────────────────────

export interface DomainCheckResult {
  domain: string
  saleStatus: DomainSaleStatus
  dnsResolved: boolean
  httpStatus?: number
  evidence: string[]
  rdapRaw?: string
  daScore?: number
  error?: string
}

// ─── Link info extracted from a page ──────────────────────────────────────────

export interface ExtractedLink {
  href: string
  anchor: string
  rel: string
  type: LinkType
}

// ─── Crawl result for a single page ───────────────────────────────────────────

export interface PageCrawlResult {
  url: string
  finalUrl: string
  statusCode: number
  internalLinks: string[]
  externalLinks: ExtractedLink[]
  canonicalUrl?: string
  sitemapUrls?: string[]
  error?: string
}

// ─── Worker config (from env) ─────────────────────────────────────────────────

export interface WorkerConfig {
  crawlConcurrency: number
  domainCheckConcurrency: number
  pollIntervalMs: number
  crawlerMaxDepth: number
  crawlerMaxPagesPerSite: number
  crawlerPageConcurrency: number
  crawlerRequestTimeoutMs: number
  crawlerRateLimitMs: number
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalSites: number
  sitesByStatus: Record<SiteStatus, number>
  totalPagesCrawled: number
  totalExternalDomains: number
  totalUzDomains: number
  totalForSaleDomains: number
  totalAvailableDomains: number
  totalErrors: number
  recentLogs: LogEntry[]
  workerRunning: boolean
  systemPaused: boolean
}

export interface LogEntry {
  id: string
  siteId?: string | null
  siteDomain?: string | null
  level: LogLevel
  message: string
  meta?: Record<string, unknown>
  createdAt: string
}
