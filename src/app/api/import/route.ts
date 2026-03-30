import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Supported import formats:
 * 1. Plain array:  ["domain.uz", "site.com"]
 * 2. Saytlar JSON: [{"Sayt manzili (URL)": "domain.uz", "Sayt nomi (Title)": "...", ...}]
 * 3. Object:       {"domains": [...]} or {"sites": [...]}
 * 4. Plain text:   one domain per line or comma-separated
 */
function extractDomainsFromBody(body: unknown): string[] {
  if (Array.isArray(body)) {
    return body.map(item => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        // Support "Sayt manzili (URL)" field (user's format)
        if (typeof obj['Sayt manzili (URL)'] === 'string') return obj['Sayt manzili (URL)'] as string
        // Fallback common field names
        if (typeof obj.url === 'string') return obj.url as string
        if (typeof obj.domain === 'string') return obj.domain as string
        if (typeof obj.site === 'string') return obj.site as string
        if (typeof obj.URL === 'string') return obj.URL as string
        // Try any string value that looks like a domain
        for (const val of Object.values(obj)) {
          if (typeof val === 'string' && val.includes('.') && !val.includes(' ')) return val
        }
      }
      return ''
    }).filter(Boolean)
  }

  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    if (Array.isArray(obj.domains)) return extractDomainsFromBody(obj.domains)
    if (Array.isArray(obj.sites)) return extractDomainsFromBody(obj.sites)
    if (Array.isArray(obj.data)) return extractDomainsFromBody(obj.data)
  }

  return []
}

function cleanDomain(raw: string): string | null {
  const d = raw.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')  // remove path
    .replace(/:\d+$/, '')  // remove port
    .replace(/^www\./, '') // strip www for dedup, but keep if intentional
    .trim()
  if (d.length < 3 || !d.includes('.')) return null
  return d
}

export async function POST(req: NextRequest) {
  let rawDomains: string[] = []

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await req.json()
    rawDomains = extractDomainsFromBody(body)
  } else {
    const text = await req.text()
    // Try JSON first
    try {
      const parsed = JSON.parse(text)
      rawDomains = extractDomainsFromBody(parsed)
    } catch {
      // Plain text: newline or comma separated
      rawDomains = text.split(/[\n,]+/).map(d => d.trim()).filter(Boolean)
    }
  }

  const cleaned = [...new Set(rawDomains.map(cleanDomain).filter(Boolean) as string[])]

  let created = 0
  let skipped = 0
  for (const domain of cleaned) {
    const existing = await prisma.site.findUnique({ where: { domain } })
    if (existing) { skipped++; continue }
    await prisma.site.create({ data: { domain } })
    created++
  }

  return NextResponse.json({ ok: true, created, skipped, total: cleaned.length })
}
