import robotsParser from 'robots-parser'
import { fetchPage } from './fetcher'
import { CRAWLER_DEFAULTS } from '../constants'

type RobotsRules = ReturnType<typeof robotsParser>

const cache = new Map<string, { rules: RobotsRules | null; fetchedAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1_000 // 10 minutes

export async function getRobotRules(baseUrl: string): Promise<RobotsRules | null> {
  const origin = new URL(baseUrl).origin
  const cached = cache.get(origin)

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rules
  }

  const robotsUrl = `${origin}/robots.txt`
  const result = await fetchPage(robotsUrl, { timeoutMs: 8_000 })

  let rules: RobotsRules | null = null
  if (result.statusCode === 200 && result.body) {
    rules = robotsParser(robotsUrl, result.body)
  }

  cache.set(origin, { rules, fetchedAt: Date.now() })
  return rules
}

export function isAllowed(rules: RobotsRules | null, url: string): boolean {
  if (!rules) return true // no robots.txt = allow all
  return rules.isAllowed(url, CRAWLER_DEFAULTS.USER_AGENT) !== false
}

export function getSitemapUrls(rules: RobotsRules | null): string[] {
  if (!rules) return []
  return rules.getSitemaps() ?? []
}

export function clearRobotsCache() {
  cache.clear()
}
