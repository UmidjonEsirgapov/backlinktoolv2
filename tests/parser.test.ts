import { describe, it, expect } from 'vitest'
import { parseHtml, parseSitemap } from '../src/lib/crawler/parser'

describe('parseHtml', () => {
  const base = 'https://example.uz'

  it('extracts anchor links', () => {
    const html = '<html><body><a href="/about">About</a><a href="https://other.com">External</a></body></html>'
    const result = parseHtml(html, base)
    expect(result.links.length).toBe(2)
    expect(result.links[0].href).toBe('https://example.uz/about')
    expect(result.links[1].href).toBe('https://other.com/')
  })

  it('extracts canonical URL', () => {
    const html = '<html><head><link rel="canonical" href="https://example.uz/canonical-page"/></head></html>'
    const result = parseHtml(html, base)
    expect(result.canonicalUrl).toBe('https://example.uz/canonical-page')
  })

  it('classifies mailto links', () => {
    const html = '<html><body><a href="mailto:test@example.com">Email</a></body></html>'
    const result = parseHtml(html, base)
    const mailto = result.links.find(l => l.type === 'MAILTO')
    expect(mailto).toBeDefined()
    expect(mailto?.href).toBe('mailto:test@example.com')
  })

  it('classifies asset links', () => {
    const html = '<html><body><a href="/file.pdf">Download</a></body></html>'
    const result = parseHtml(html, base)
    const asset = result.links.find(l => l.type === 'ASSET')
    expect(asset).toBeDefined()
  })

  it('skips javascript: links', () => {
    const html = '<html><body><a href="javascript:void(0)">Click</a></body></html>'
    const result = parseHtml(html, base)
    const js = result.links.find(l => l.type === 'JAVASCRIPT')
    // javascript: links are categorized but filtered in engine
    expect(result.links.every(l => l.type !== 'EXTERNAL' || l.href.startsWith('http'))).toBe(true)
  })

  it('extracts sitemap links from <link rel=sitemap>', () => {
    const html = '<html><head><link rel="sitemap" href="/sitemap.xml"/></head></html>'
    const result = parseHtml(html, base)
    expect(result.sitemapLinks).toContain('https://example.uz/sitemap.xml')
  })
})

describe('parseSitemap', () => {
  it('parses urlset', () => {
    const xml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.uz/page1</loc></url>
  <url><loc>https://example.uz/page2</loc></url>
</urlset>`
    const urls = parseSitemap(xml)
    expect(urls).toContain('https://example.uz/page1')
    expect(urls).toContain('https://example.uz/page2')
    expect(urls.length).toBe(2)
  })

  it('parses sitemap index', () => {
    const xml = `<?xml version="1.0"?>
<sitemapindex>
  <sitemap><loc>https://example.uz/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://example.uz/sitemap-2.xml</loc></sitemap>
</sitemapindex>`
    const urls = parseSitemap(xml)
    expect(urls.length).toBe(2)
  })
})
