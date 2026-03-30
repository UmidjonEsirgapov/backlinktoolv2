import { fetch, type Response } from 'undici'
import { CRAWLER_DEFAULTS } from '../constants'

export interface FetchResult {
  url: string
  finalUrl: string
  statusCode: number
  headers: Record<string, string>
  body: string
  redirectChain: string[]
  error?: string
  durationMs: number
}

interface FetchOptions {
  timeoutMs?: number
  maxRedirects?: number
  userAgent?: string
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchPage(
  url: string,
  options: FetchOptions = {},
  attempt = 1,
): Promise<FetchResult> {
  const {
    timeoutMs = CRAWLER_DEFAULTS.REQUEST_TIMEOUT_MS,
    maxRedirects = CRAWLER_DEFAULTS.MAX_REDIRECTS,
    userAgent = CRAWLER_DEFAULTS.USER_AGENT,
  } = options

  const start = Date.now()
  const redirectChain: string[] = []
  let currentUrl = url

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
        },
        redirect: 'manual',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    // Manual redirect following to capture chain
    let redirectCount = 0
    let resp = response
    while (
      (resp.status === 301 || resp.status === 302 || resp.status === 303 ||
       resp.status === 307 || resp.status === 308) &&
      redirectCount < maxRedirects
    ) {
      const location = resp.headers.get('location')
      if (!location) break
      redirectChain.push(currentUrl)

      // Resolve relative redirect
      currentUrl = new URL(location, currentUrl).toString()
      redirectCount++

      const ctrl2 = new AbortController()
      const t2 = setTimeout(() => ctrl2.abort(), timeoutMs)
      try {
        resp = await fetch(currentUrl, {
          method: 'GET',
          headers: { 'User-Agent': userAgent, Accept: 'text/html,*/*' },
          redirect: 'manual',
          signal: ctrl2.signal,
        })
      } finally {
        clearTimeout(t2)
      }
    }

    const contentType = resp.headers.get('content-type') ?? ''
    // Only read body if it looks like text
    let body = ''
    if (contentType.includes('text/') || contentType.includes('application/xhtml')) {
      body = await resp.text()
    }

    const headers: Record<string, string> = {}
    resp.headers.forEach((value, key) => { headers[key] = value })

    return {
      url,
      finalUrl: currentUrl,
      statusCode: resp.status,
      headers,
      body,
      redirectChain,
      durationMs: Date.now() - start,
    }
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError'

    if (attempt < 3 && !isAbort) {
      // Exponential backoff retry
      await sleep(500 * 2 ** (attempt - 1))
      return fetchPage(url, options, attempt + 1)
    }

    return {
      url,
      finalUrl: currentUrl,
      statusCode: 0,
      headers: {},
      body: '',
      redirectChain,
      error: isAbort
        ? `Request timed out after ${timeoutMs}ms`
        : (err instanceof Error ? err.message : String(err)),
      durationMs: Date.now() - start,
    }
  }
}

/** Lightweight HEAD-only check for domain availability check */
export async function fetchHead(url: string, timeoutMs = 10_000): Promise<{
  statusCode: number
  finalUrl: string
  error?: string
}> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const resp = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': CRAWLER_DEFAULTS.USER_AGENT },
        redirect: 'follow',
        signal: ctrl.signal,
      })
      return { statusCode: resp.status, finalUrl: resp.url }
    } finally {
      clearTimeout(t)
    }
  } catch (err) {
    return {
      statusCode: 0,
      finalUrl: url,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
