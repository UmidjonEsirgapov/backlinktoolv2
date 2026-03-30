import dns from 'dns/promises'
import { DOMAIN_CHECK } from '../constants'

export interface DnsResult {
  resolved: boolean
  addresses: string[]
  error?: string
}

export async function checkDns(domain: string): Promise<DnsResult> {
  try {
    const resolver = new dns.Resolver()
    resolver.setServers(['1.1.1.1', '8.8.8.8'])

    // Set a reasonable timeout by racing with a timer
    const lookup = resolver.resolve4(domain).catch(() => resolver.resolve6(domain))

    const result = await Promise.race([
      lookup,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DNS timeout')), DOMAIN_CHECK.DNS_TIMEOUT_MS),
      ),
    ])

    return { resolved: true, addresses: result }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    // ENOTFOUND, ENODATA, NXDOMAIN → domain not registered
    const isNxDomain =
      errMsg.includes('ENOTFOUND') ||
      errMsg.includes('ENODATA') ||
      errMsg.includes('NXDOMAIN')

    return {
      resolved: false,
      addresses: [],
      error: isNxDomain ? 'NXDOMAIN' : errMsg,
    }
  }
}
