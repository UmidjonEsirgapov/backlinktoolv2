/**
 * Unified domain availability & sale status checker.
 * Pipeline:
 *   1. DNS check — NXDOMAIN → AVAILABLE (can register directly)
 *   2. HTTP parking check — detects for-sale / parked pages
 *   3. RDAP check — extra data on registration status
 *   4. DA score (optional)
 */
import { checkDns } from './dns'
import { checkParking } from './parking'
import { checkRdap } from './rdap'
import { getDaScore } from './da'
import type { DomainCheckResult, DomainSaleStatus } from '../types'

export async function checkDomainAvailability(domain: string): Promise<DomainCheckResult> {
  const evidence: string[] = []
  let saleStatus: DomainSaleStatus = 'UNKNOWN'
  let rdapRaw: string | undefined
  let httpStatus: number | undefined
  let dnsResolved = false
  let daScore: number | null = null

  // ── Step 1: DNS ────────────────────────────────────────────────────────────
  const dnsResult = await checkDns(domain)
  dnsResolved = dnsResult.resolved

  if (!dnsResolved && dnsResult.error === 'NXDOMAIN') {
    saleStatus = 'AVAILABLE'
    evidence.push('DNS: NXDOMAIN — domain not registered or expired')

    // Still run RDAP to check if it's in redemption / pending delete
    const rdap = await checkRdap(domain).catch(() => null)
    if (rdap) {
      rdapRaw = JSON.stringify(rdap.raw)
      const statusLower = rdap.status.map(s => s.toLowerCase())
      if (statusLower.some(s => s.includes('redemption') || s.includes('pending delete'))) {
        saleStatus = 'FOR_SALE'
        evidence.push(`RDAP status: ${rdap.status.join(', ')}`)
      } else if (statusLower.includes('available')) {
        saleStatus = 'AVAILABLE'
        evidence.push('RDAP: domain available')
      }
    }

    daScore = await getDaScore(domain).catch(() => null)
    return {
      domain, saleStatus, dnsResolved, httpStatus, evidence, rdapRaw,
      daScore: daScore ?? undefined,
    }
  }

  // ── Step 2: HTTP parking check (domain resolves) ───────────────────────────
  const parking = await checkParking(domain)
  httpStatus = parking.httpStatus

  if (parking.isSale) {
    saleStatus = 'FOR_SALE'
    evidence.push(...parking.evidence)
  } else if (parking.isExpired) {
    saleStatus = 'FOR_SALE'
    evidence.push(...parking.evidence)
  } else if (parking.isParked) {
    saleStatus = 'FOR_SALE'
    evidence.push(...parking.evidence)
  }

  // ── Step 3: RDAP ───────────────────────────────────────────────────────────
  const rdap = await checkRdap(domain).catch(() => null)
  if (rdap) {
    rdapRaw = JSON.stringify(rdap.raw)
    const statusLower = rdap.status.map(s => s.toLowerCase())

    if (statusLower.some(s => s.includes('redemption') || s.includes('pending delete'))) {
      if (saleStatus === 'UNKNOWN') saleStatus = 'FOR_SALE'
      evidence.push(`RDAP status: ${rdap.status.join(', ')}`)
    }

    if (statusLower.some(s => s.includes('client hold') || s.includes('server hold'))) {
      evidence.push(`RDAP domain on hold: ${rdap.status.join(', ')}`)
    }
  }

  // ── Step 4: DA score (optional) ───────────────────────────────────────────
  daScore = await getDaScore(domain).catch(() => null)

  // If we found no sale signals, mark as NOT_FOR_SALE
  if (saleStatus === 'UNKNOWN' && dnsResolved) {
    saleStatus = 'NOT_FOR_SALE'
  }

  return {
    domain,
    saleStatus,
    dnsResolved,
    httpStatus,
    evidence,
    rdapRaw,
    daScore: daScore ?? undefined,
  }
}
