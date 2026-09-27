import { afterEach, describe, expect, it } from 'vitest'
import { companyConfig } from '../data/company'
import { absoluteUrl, schemaId, siteOrigin } from './site'

/**
 * Canonical-origin resolution.
 *
 * The point of these cases is the unconfigured state: before the owner sets
 * the production domain, nothing may emit a guessed host. A canonical tag
 * pointing at a domain that does not exist is worse for the business than no
 * canonical tag at all.
 *
 * `companyConfig` is mutated in place at runtime by content/store.ts, so the
 * tests mutate it the same way rather than mocking the module.
 */

const original = companyConfig.siteUrl

afterEach(() => {
  companyConfig.siteUrl = original
})

describe('siteOrigin', () => {
  it('is empty when nothing is configured and there is no browser origin', () => {
    companyConfig.siteUrl = ''
    expect(siteOrigin()).toBe('')
  })

  it('uses the configured production URL', () => {
    companyConfig.siteUrl = 'https://example.co.in'
    expect(siteOrigin()).toBe('https://example.co.in')
  })

  it('reduces a configured URL to its origin', () => {
    companyConfig.siteUrl = 'https://example.co.in/home?utm=x#top'
    expect(siteOrigin()).toBe('https://example.co.in')
  })

  it('ignores a malformed configured value rather than throwing', () => {
    companyConfig.siteUrl = 'not a url'
    expect(siteOrigin()).toBe('')
  })

  it('ignores a non-http scheme', () => {
    companyConfig.siteUrl = 'javascript:alert(1)'
    expect(siteOrigin()).toBe('')
  })
})

describe('absoluteUrl', () => {
  it('returns the path unchanged when no origin is known', () => {
    companyConfig.siteUrl = ''
    expect(absoluteUrl('/products/rcc')).toBe('/products/rcc')
  })

  it('builds an absolute URL once the domain is configured', () => {
    companyConfig.siteUrl = 'https://example.co.in'
    expect(absoluteUrl('/products/rcc')).toBe('https://example.co.in/products/rcc')
  })

  it('never invents a host', () => {
    companyConfig.siteUrl = ''
    expect(absoluteUrl('/about')).not.toMatch(/^https?:\/\//)
  })
})

describe('schemaId', () => {
  it('falls back to a document-relative fragment', () => {
    companyConfig.siteUrl = ''
    expect(schemaId('organization')).toBe('#organization')
  })

  it('is absolute once the domain is configured', () => {
    companyConfig.siteUrl = 'https://example.co.in'
    expect(schemaId('organization')).toBe('https://example.co.in/#organization')
  })
})
