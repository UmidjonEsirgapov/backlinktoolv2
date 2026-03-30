import { TRACKING_PARAMS } from '../constants'

/**
 * Normalize a URL for deduplication.
 * Removes fragments, sorts params, strips tracking params,
 * lowercases scheme+host, removes default ports.
 */
export function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url)

    // Only handle http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

    // Lowercase scheme and host
    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = parsed.hostname.toLowerCase()

    // Remove default ports
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = ''
    }

    // Remove fragment
    parsed.hash = ''

    // Strip tracking params
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param)
    }

    // Sort remaining search params for consistent ordering
    parsed.searchParams.sort()

    // Normalize path: remove double slashes, resolve dots
    let pth = parsed.pathname
    pth = pth.replace(/\/+/g, '/') // collapse double slashes
    // Normalize trailing slash: add for root, remove for paths
    if (pth !== '/' && pth.endsWith('/')) pth = pth.slice(0, -1)
    parsed.pathname = pth

    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Resolve a potentially relative URL against a base URL.
 * Returns null if resolution fails or result is not http/https.
 */
export function resolveUrl(href: string, base: string): string | null {
  try {
    const resolved = new URL(href, base)
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null
    return resolved.toString()
  } catch {
    return null
  }
}

import { parse as parseTld } from 'tldts'

/**
 * Return the registered domain (eTLD+1) from a URL, e.g.
 * "https://sub.example.uz/page" → "example.uz"
 */
export function extractRegisteredDomain(url: string): string | null {
  try {
    const result = parseTld(url, { allowPrivateDomains: false })
    return result.domain ?? null
  } catch {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  }
}

/** Same as extractRegisteredDomain but from a bare domain string (not URL) */
export function normalizeDomain(domain: string): string | null {
  try {
    const result = parseTld(`https://${domain}`, { allowPrivateDomains: false })
    return result.domain ?? null
  } catch {
    return domain.toLowerCase().replace(/^www\./, '').trim() || null
  }
}

export function isUzDomain(domain: string): boolean {
  return domain.endsWith('.uz')
}

/** Check if two URLs are on the same registered domain */
export function isSameDomain(url: string, baseDomain: string): boolean {
  const d = extractRegisteredDomain(url)
  return d === baseDomain
}
