import { describe, it, expect } from 'vitest'
import {
  normalizeUrl,
  resolveUrl,
  extractRegisteredDomain,
  normalizeDomain,
  isUzDomain,
  isSameDomain,
} from '../src/lib/crawler/normalizer'

describe('normalizeUrl', () => {
  it('removes fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page')
  })

  it('removes UTM params', () => {
    const url = 'https://example.com/page?utm_source=google&utm_medium=cpc&id=1'
    expect(normalizeUrl(url)).toBe('https://example.com/page?id=1')
  })

  it('sorts query params', () => {
    const url = 'https://example.com/page?z=1&a=2'
    expect(normalizeUrl(url)).toBe('https://example.com/page?a=2&z=1')
  })

  it('lowercases scheme and host', () => {
    expect(normalizeUrl('HTTPS://EXAMPLE.COM/PAGE')).toBe('https://example.com/PAGE')
  })

  it('removes default port 443', () => {
    expect(normalizeUrl('https://example.com:443/page')).toBe('https://example.com/page')
  })

  it('removes default port 80', () => {
    expect(normalizeUrl('http://example.com:80/page')).toBe('http://example.com/page')
  })

  it('removes trailing slash on paths', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page')
  })

  it('keeps root slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/')
  })

  it('returns null for non-http', () => {
    expect(normalizeUrl('ftp://example.com/')).toBeNull()
    expect(normalizeUrl('mailto:test@example.com')).toBeNull()
  })

  it('returns null for invalid URL', () => {
    expect(normalizeUrl('not a url')).toBeNull()
  })
})

describe('resolveUrl', () => {
  it('resolves relative URL', () => {
    expect(resolveUrl('/about', 'https://example.com')).toBe('https://example.com/about')
  })

  it('resolves root-relative URL', () => {
    expect(resolveUrl('/path/to/page', 'https://example.com/other')).toBe('https://example.com/path/to/page')
  })

  it('returns absolute URL as-is', () => {
    expect(resolveUrl('https://other.com/', 'https://example.com')).toBe('https://other.com/')
  })

  it('returns null for non-http after resolution', () => {
    expect(resolveUrl('mailto:test@x.com', 'https://example.com')).toBeNull()
  })
})

describe('extractRegisteredDomain', () => {
  it('extracts domain from URL', () => {
    expect(extractRegisteredDomain('https://sub.example.uz/page')).toBe('example.uz')
  })

  it('extracts from www', () => {
    expect(extractRegisteredDomain('https://www.test.com/page')).toBe('test.com')
  })
})

describe('normalizeDomain', () => {
  it('strips www', () => {
    expect(normalizeDomain('www.example.uz')).toBe('example.uz')
  })

  it('lowercases', () => {
    expect(normalizeDomain('Example.UZ')).toBe('example.uz')
  })
})

describe('isUzDomain', () => {
  it('detects .uz', () => {
    expect(isUzDomain('example.uz')).toBe(true)
    expect(isUzDomain('example.com')).toBe(false)
    expect(isUzDomain('sub.example.uz')).toBe(true)
  })
})

describe('isSameDomain', () => {
  it('matches same domain', () => {
    expect(isSameDomain('https://sub.example.uz/page', 'example.uz')).toBe(true)
    expect(isSameDomain('https://other.com/page', 'example.uz')).toBe(false)
  })
})
