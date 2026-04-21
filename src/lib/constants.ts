export const CRAWLER_DEFAULTS = {
  MAX_DEPTH: 20,
  /** Prisma Int32 maksimumi — amalda “cheksiz” sayt crawl uchun */
  MAX_PAGES_PER_SITE: 2_147_483_647,
  /** Sitemapdan boshlang‘ich navbatga olinadigan URL limiti (xotira uchun) */
  MAX_SITEMAP_SEED_URLS: 1_000_000,
  PAGE_CONCURRENCY: 5,
  REQUEST_TIMEOUT_MS: 15_000,
  RATE_LIMIT_MS: 500,
  MAX_REDIRECTS: 5,
  MAX_OUTBOUND_LINKS_PER_PAGE: 200,
  USER_AGENT:
    'Mozilla/5.0 (compatible; BacklinkBot/1.0; +https://github.com/infoedu/backlink-tool)',
} as const

export const WORKER_DEFAULTS = {
  CRAWL_CONCURRENCY: 3,
  DOMAIN_CHECK_CONCURRENCY: 10,
  POLL_INTERVAL_MS: 2_000,
  JOB_STALE_AFTER_MS: 10 * 60 * 1_000, // 10 minutes
} as const

export const DOMAIN_CHECK = {
  HTTP_TIMEOUT_MS: 10_000,
  DNS_TIMEOUT_MS: 5_000,
  MAX_RETRY: 2,
} as const

// URL schemes to skip during crawl
export const SKIP_SCHEMES = ['mailto:', 'tel:', 'javascript:', 'data:', 'ftp:', 'ftps:']

// File extensions that are assets, not HTML pages
export const ASSET_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.tar', '.gz', '.7z',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
  '.css', '.js', '.json', '.xml', '.txt', '.csv',
  '.woff', '.woff2', '.ttf', '.eot',
])

// Known parking / for-sale page indicators (lowercased)
export const PARKING_PATTERNS = [
  'this domain is for sale',
  'domain is for sale',
  'buy this domain',
  'domain for sale',
  'purchase this domain',
  'domain may be for sale',
  'domain parking',
  'parked domain',
  'parked free',
  'domain has expired',
  'this domain expired',
  'domain name has expired',
  'renew this domain',
  'contact us about this domain',
  'inquire about this domain',
  'make an offer',
  'domain auction',
  'sedoparking',
  'sedo.com',
  'afternic.com',
  'dan.com',
  'flippa.com',
  'hugedomains.com',
  'undeveloped.com',
  'squadhelp.com',
  'brandpa.com',
  'godaddy.com/domainsearch',
  'namecheap.com/domains',
  'register.it',
  'parkingcrew.net',
  'bodis.com',
  'above.com',
  'tonic.com',
] as const

// RDAP bootstrap URL
export const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json'

// Tracking params to strip from URLs for deduplication
export const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'yclid', 'mc_cid', 'mc_eid',
  '_ga', '_gl', 'ref', 'source',
]
