import * as cheerio from 'cheerio'
import type { ExtractedLink, LinkType } from '../types'
import { SKIP_SCHEMES, ASSET_EXTENSIONS } from '../constants'
import { resolveUrl, normalizeUrl } from './normalizer'

export interface ParseResult {
  canonicalUrl: string | null
  title: string
  links: ExtractedLink[]
  sitemapLinks: string[]
}

function classifyHref(href: string): LinkType | 'skip' {
  const lower = href.toLowerCase().trim()
  if (!lower) return 'skip'
  for (const scheme of SKIP_SCHEMES) {
    if (lower.startsWith(scheme)) {
      if (lower.startsWith('mailto:')) return 'MAILTO'
      if (lower.startsWith('tel:')) return 'TEL'
      return 'JAVASCRIPT'
    }
  }
  // Check for asset extensions
  try {
    const pathname = new URL(href).pathname.toLowerCase()
    const ext = pathname.slice(pathname.lastIndexOf('.'))
    if (ASSET_EXTENSIONS.has(ext)) return 'ASSET'
  } catch {
    const ext = href.toLowerCase().split('?')[0]
    const dot = ext.lastIndexOf('.')
    if (dot !== -1 && ASSET_EXTENSIONS.has(ext.slice(dot))) return 'ASSET'
  }
  return 'EXTERNAL' // will be reclassified as INTERNAL by caller
}

export function parseHtml(html: string, pageUrl: string): ParseResult {
  const $ = cheerio.load(html)
  const links: ExtractedLink[] = []
  const sitemapLinks: string[] = []

  // ── Canonical URL ─────────────────────────────────────────────────────────
  const canonicalHref = $('link[rel="canonical"]').attr('href')
  let canonicalUrl: string | null = null
  if (canonicalHref) {
    canonicalUrl = resolveUrl(canonicalHref, pageUrl)
  }

  // ── Sitemap from <link rel="sitemap"> ────────────────────────────────────
  $('link[rel="sitemap"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) {
      const resolved = resolveUrl(href, pageUrl)
      if (resolved) sitemapLinks.push(resolved)
    }
  })

  // ── All <a href> links ────────────────────────────────────────────────────
  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href')?.trim()
    if (!rawHref) return

    const type = classifyHref(rawHref)
    if (type === 'skip') return

    // For non-http links (mailto/tel/asset), keep raw href
    if (type === 'MAILTO' || type === 'TEL') {
      links.push({
        href: rawHref,
        anchor: $(el).text().trim().slice(0, 200),
        rel: $(el).attr('rel') ?? '',
        type,
      })
      return
    }

    const resolved = resolveUrl(rawHref, pageUrl)
    if (!resolved) return

    const normalized = normalizeUrl(resolved)
    if (!normalized) return

    const rel = $(el).attr('rel') ?? ''
    links.push({
      href: normalized,
      anchor: $(el).text().trim().slice(0, 200),
      rel,
      type, // will be 'EXTERNAL' or 'ASSET'; caller reclassifies internal
    })
  })

  // ── <area href> in image maps ─────────────────────────────────────────────
  $('area[href]').each((_, el) => {
    const rawHref = $(el).attr('href')?.trim()
    if (!rawHref) return
    const resolved = resolveUrl(rawHref, pageUrl)
    if (!resolved) return
    const normalized = normalizeUrl(resolved)
    if (!normalized) return
    links.push({
      href: normalized,
      anchor: $(el).attr('alt') ?? '',
      rel: $(el).attr('rel') ?? '',
      type: 'EXTERNAL',
    })
  })

  const title = $('title').first().text().trim().slice(0, 300)

  return { canonicalUrl, title, links, sitemapLinks }
}

/** Parse a sitemap XML and extract all <loc> URLs */
export function parseSitemap(xml: string): string[] {
  const urls: string[] = []
  // Handle both sitemap index and urlset
  const locMatches = xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)
  for (const match of locMatches) {
    const url = match[1].trim()
    if (url.startsWith('http')) urls.push(url)
  }
  return urls
}
