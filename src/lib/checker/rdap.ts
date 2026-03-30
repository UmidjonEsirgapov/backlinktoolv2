/**
 * RDAP domain lookup — free, no API key needed.
 * Uses IANA RDAP bootstrap to find the right server per TLD.
 */
import { fetch } from 'undici'

interface RdapBootstrap {
  services: [string[], string[]][]
}

let bootstrapCache: RdapBootstrap | null = null
let bootstrapFetchedAt = 0
const BOOTSTRAP_TTL = 60 * 60 * 1_000 // 1 hour

async function getBootstrap(): Promise<RdapBootstrap | null> {
  if (bootstrapCache && Date.now() - bootstrapFetchedAt < BOOTSTRAP_TTL) {
    return bootstrapCache
  }
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 8_000)
    const res = await fetch('https://data.iana.org/rdap/dns.json', { signal: ctrl.signal })
    if (!res.ok) return null
    bootstrapCache = (await res.json()) as RdapBootstrap
    bootstrapFetchedAt = Date.now()
    return bootstrapCache
  } catch {
    return null
  }
}

function getRdapBase(tld: string, bootstrap: RdapBootstrap): string | null {
  const tldLower = tld.toLowerCase()
  for (const [tlds, servers] of bootstrap.services) {
    if (tlds.includes(tldLower) && servers.length > 0) {
      return servers[0].replace(/\/$/, '')
    }
  }
  return null
}

export interface RdapResult {
  status: string[]
  events: { action: string; date: string }[]
  registrar?: string
  raw: unknown
  error?: string
}

export async function checkRdap(domain: string): Promise<RdapResult | null> {
  try {
    const parts = domain.split('.')
    const tld = parts[parts.length - 1]

    const bootstrap = await getBootstrap()
    if (!bootstrap) return null

    const base = getRdapBase(tld, bootstrap)
    if (!base) return null

    const url = `${base}/domain/${domain}`
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 8_000)

    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/rdap+json' },
    })

    if (res.status === 404) {
      // Domain not found in registry = likely available
      return {
        status: ['available'],
        events: [],
        raw: null,
      }
    }

    if (!res.ok) return null

    const data = (await res.json()) as Record<string, unknown>
    const status = Array.isArray(data.status) ? (data.status as string[]) : []
    const events = Array.isArray(data.events)
      ? (data.events as Array<{ eventAction: string; eventDate: string }>).map(e => ({
          action: e.eventAction,
          date: e.eventDate,
        }))
      : []

    let registrar: string | undefined
    if (Array.isArray(data.entities)) {
      const reg = (data.entities as Array<{ roles?: string[]; vcardArray?: unknown[] }>).find(
        e => Array.isArray(e.roles) && e.roles.includes('registrar'),
      )
      if (reg?.vcardArray && Array.isArray(reg.vcardArray[1])) {
        const fn = (reg.vcardArray[1] as Array<[string, unknown, unknown, string]>).find(
          v => v[0] === 'fn',
        )
        if (fn) registrar = String(fn[3])
      }
    }

    return { status, events, registrar, raw: data }
  } catch {
    return null
  }
}
