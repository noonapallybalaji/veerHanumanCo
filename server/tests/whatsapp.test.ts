import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * WhatsApp link generation.
 *
 * The frontend helper is the single source of every wa.me URL on the site
 * (header, footer, product pages, mobile bar, floating button), so these
 * tests pin its behaviour: correct encoding, and a safe no-link state when
 * the business number has not been configured.
 *
 * The module reads companyConfig at import time, so each case re-imports it
 * with a fresh module registry after setting the number.
 */

async function loadContact(config: { whatsapp?: string; phone?: string; email?: string }) {
  vi.resetModules()
  const company = await import('../../src/data/company.js')
  Object.assign(company.companyConfig, {
    whatsapp: config.whatsapp ?? '',
    phone: config.phone ?? '',
    email: config.email ?? '',
  })
  return import('../../src/lib/contact.js')
}

afterEach(() => {
  vi.resetModules()
})

describe('whatsapp link generation', () => {
  it('builds a wa.me URL from the configured number', async () => {
    const contact = await loadContact({ whatsapp: '919876543210' })
    const href = contact.whatsAppHref('Hello')

    expect(href).toBeDefined()
    expect(href!.startsWith('https://wa.me/919876543210?text=')).toBe(true)
  })

  it('strips punctuation and spaces from the configured number', async () => {
    const contact = await loadContact({ whatsapp: '+91 98765 43210' })
    // wa.me accepts digits only; anything else silently breaks the link.
    expect(contact.whatsAppHref('Hi')).toContain('wa.me/919876543210')
  })

  it('URL-encodes the prefilled message', async () => {
    const contact = await loadContact({ whatsapp: '919876543210' })
    const href = contact.whatsAppHref('RCC & FRP: 600mm?\nQuantity 100')!

    const text = new URL(href).searchParams.get('text')
    expect(text).toBe('RCC & FRP: 600mm?\nQuantity 100')
    // Raw separators must not survive into the query string.
    expect(href).not.toContain('& FRP')
    expect(href).not.toContain('\n')
    expect(href).toContain('%0A')
  })

  it('returns undefined when no number is configured', async () => {
    const contact = await loadContact({ whatsapp: '' })

    expect(contact.hasWhatsApp).toBe(false)
    // Callers use this to render nothing, rather than a dead link.
    expect(contact.whatsAppHref('Hello')).toBeUndefined()
  })

  it('treats a whitespace-only number as unconfigured', async () => {
    const contact = await loadContact({ whatsapp: '   ' })
    expect(contact.hasWhatsApp).toBe(false)
    expect(contact.whatsAppHref('Hello')).toBeUndefined()
  })

  it('keeps product enquiry messages free of visitor personal data', async () => {
    const contact = await loadContact({ whatsapp: '919876543210' })
    const message = contact.productEnquiryMessage('RCC Chambers', 'RCC')

    expect(message).toContain('RCC Chambers')
    expect(message).toContain('RCC')
    // The prefilled text describes the product only. Nothing about the
    // visitor should be pushed into a URL that lands in their chat history
    // and the recipient's notification preview.
    expect(message).not.toMatch(/\b\d{10}\b/)
    expect(message).not.toContain('@')
  })

  it('produces one consistent URL shape across every message builder', async () => {
    const contact = await loadContact({ whatsapp: '919876543210' })

    const hrefs = [
      contact.whatsAppHref(contact.generalEnquiryMessage()),
      contact.whatsAppHref(contact.productEnquiryMessage('DWC', 'Pipes')),
      contact.whatsAppHref(contact.serviceEnquiryMessage('Landscaping')),
      contact.whatsAppHref(contact.requirementEnquiryMessage('Drainage')),
    ]

    for (const href of hrefs) {
      expect(href).toBeDefined()
      const url = new URL(href!)
      expect(url.origin).toBe('https://wa.me')
      expect(url.pathname).toBe('/919876543210')
      expect(url.searchParams.get('text')).toBeTruthy()
    }
  })
})
