import { describe, it, expect } from 'vitest'
import { PARKING_PATTERNS } from '../src/lib/constants'

describe('PARKING_PATTERNS', () => {
  it('contains expected sale indicators', () => {
    expect(PARKING_PATTERNS).toContain('buy this domain')
    expect(PARKING_PATTERNS).toContain('domain for sale')
    expect(PARKING_PATTERNS).toContain('sedo.com')
    expect(PARKING_PATTERNS).toContain('dan.com')
    expect(PARKING_PATTERNS).toContain('afternic.com')
  })

  it('all patterns are lowercase', () => {
    for (const p of PARKING_PATTERNS) {
      expect(p).toBe(p.toLowerCase())
    }
  })
})

describe('parking detection logic', () => {
  function detectSale(bodyHtml: string): boolean {
    const bodyLower = bodyHtml.toLowerCase()
    return PARKING_PATTERNS.some(p => bodyLower.includes(p))
  }

  it('detects GoDaddy parking', () => {
    const html = '<html><body><h1>Buy this domain</h1><p>This domain may be for sale.</p></body></html>'
    expect(detectSale(html)).toBe(true)
  })

  it('detects Sedo redirect signal', () => {
    const html = '<html><body><p>Domain managed by sedo.com parking service</p></body></html>'
    expect(detectSale(html)).toBe(true)
  })

  it('does not false-positive on normal sites', () => {
    const html = '<html><body><h1>Welcome to Our Company</h1><p>We provide consulting services.</p></body></html>'
    expect(detectSale(html)).toBe(false)
  })

  it('detects expired domain page', () => {
    const html = '<html><body><h2>This domain has expired</h2><a href="#">Renew this domain</a></body></html>'
    expect(detectSale(html)).toBe(true)
  })
})
