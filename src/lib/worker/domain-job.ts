import { prisma } from '../db'
import { checkDomainAvailability } from '../checker'
import { globalLogger } from '../logger'
import type { CheckDomainPayload } from '../types'

export async function processCheckDomain(payload: CheckDomainPayload): Promise<void> {
  const { domainId, domain } = payload

  const existing = await prisma.externalDomain.findUnique({ where: { id: domainId } })
  if (!existing) {
    throw new Error(`Domain ${domainId} not found`)
  }

  await globalLogger.info(`Checking availability: ${domain}`)

  const result = await checkDomainAvailability(domain)

  await prisma.externalDomain.update({
    where: { id: domainId },
    data: {
      saleStatus: result.saleStatus,
      dnsResolved: result.dnsResolved,
      httpStatus: result.httpStatus ?? null,
      evidence: result.evidence.length ? JSON.stringify(result.evidence) : null,
      rdapRaw: result.rdapRaw ?? null,
      daScore: result.daScore ?? null,
      checkError: result.error ?? null,
      lastChecked: new Date(),
    },
  })

  await globalLogger.info(
    `Domain ${domain}: ${result.saleStatus}${result.evidence.length ? ` (${result.evidence[0]})` : ''}`,
    { domain, status: result.saleStatus },
  )
}
