/**
 * Detect whether a domain is parked / for sale by fetching its home page
 * and matching against known patterns.
 */
import { fetchPage } from '../crawler/fetcher'
import { PARKING_PATTERNS, DOMAIN_CHECK } from '../constants'

export interface ParkingCheckResult {
  isParked: boolean
  isSale: boolean
  isExpired: boolean
  evidence: string[]
  httpStatus: number
  finalUrl: string
  error?: string
}

export async function checkParking(domain: string): Promise<ParkingCheckResult> {
  const evidence: string[] = []
  let httpStatus = 0
  let finalUrl = `https://${domain}`

  for (const scheme of ['https', 'http']) {
    const url = `${scheme}://${domain}`
    const res = await fetchPage(url, { timeoutMs: DOMAIN_CHECK.HTTP_TIMEOUT_MS, maxRedirects: 3 })

    if (res.statusCode > 0) {
      httpStatus = res.statusCode
      finalUrl = res.finalUrl
      const bodyLower = res.body.toLowerCase()

      for (const pattern of PARKING_PATTERNS) {
        if (bodyLower.includes(pattern)) {
          evidence.push(pattern)
        }
      }

      // Check final URL redirect to known registrar/parking services
      const finalDomain = res.finalUrl.toLowerCase()
      const registrarRedirects = [
        'sedo.com', 'afternic.com', 'dan.com', 'flippa.com',
        'godaddy.com', 'namecheap.com', 'hugedomains.com',
        'bodis.com', 'above.com', 'parkingcrew.net',
      ]
      for (const redir of registrarRedirects) {
        if (finalDomain.includes(redir) && !finalDomain.includes(domain)) {
          evidence.push(`Redirects to ${redir}`)
        }
      }

      break // got a response, no need to try http
    }
  }

  const isParked = evidence.length > 0
  const isExpired = evidence.some(e =>
    e.includes('expired') || e.includes('renew'),
  )
  const isSale = evidence.some(e =>
    e.includes('sale') || e.includes('buy') || e.includes('purchase') ||
    e.includes('offer') || e.includes('auction') || e.includes('broker') ||
    e.includes('dan.com') || e.includes('sedo') || e.includes('afternic') ||
    e.includes('flippa') || e.includes('hugedomains') || e.includes('Redirects to'),
  )

  return { isParked, isSale, isExpired, evidence, httpStatus, finalUrl }
}
