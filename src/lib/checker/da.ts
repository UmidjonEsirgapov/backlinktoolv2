/**
 * OPTIONAL: Domain Authority / Page Rank score via OpenPageRank API.
 * If OPENPAGERANK_API_KEY is not set, this module returns null gracefully.
 * Get a free API key at: https://www.domcop.com/openpagerank/
 */
import { fetch } from 'undici'

export async function getDaScore(domain: string): Promise<number | null> {
  const apiKey = process.env.OPENPAGERANK_API_KEY
  if (!apiKey) return null

  try {
    const url = `https://openpagerank.com/api/v1.0/getPageRank?domains%5B0%5D=${encodeURIComponent(domain)}`
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 8_000)

    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { API_KEY: apiKey },
    })

    if (!res.ok) return null
    const data = (await res.json()) as {
      response?: Array<{ page_rank_integer?: number; status_code?: number }>
    }
    const first = data.response?.[0]
    if (first?.status_code === 200 && typeof first.page_rank_integer === 'number') {
      return first.page_rank_integer
    }
    return null
  } catch {
    return null
  }
}
