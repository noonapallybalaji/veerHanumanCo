import { describe, expect, it } from 'vitest'
import { showsOnRoute } from './FloatingWhatsApp'

/**
 * Where the floating WhatsApp button is allowed to appear.
 *
 * The link itself is covered in server/tests/whatsapp.test.ts — this is only
 * the route rule, which is the part most likely to be broken silently by a
 * routing change.
 */

describe('floating WhatsApp route visibility', () => {
  it('is suppressed across the admin panel', () => {
    // Staff-facing pages; a public contact CTA has no place there, and it
    // would overlap the admin toolbars.
    expect(showsOnRoute('/admin')).toBe(false)
    expect(showsOnRoute('/admin/login')).toBe(false)
    expect(showsOnRoute('/admin/products/rcc-poles')).toBe(false)
  })

  it('is suppressed on the pages that already are the enquiry', () => {
    // A floating duplicate competes with the form the visitor is filling in.
    expect(showsOnRoute('/request-quote')).toBe(false)
    expect(showsOnRoute('/contact')).toBe(false)
    expect(showsOnRoute('/contact/')).toBe(false)
  })

  it('is shown on the public browsing pages', () => {
    for (const path of [
      '/',
      '/products',
      '/products/rcc',
      '/products/rcc/rcc-chambers',
      '/services',
      '/projects',
      '/about',
    ]) {
      expect(showsOnRoute(path), path).toBe(true)
    }
  })

  it('matches path segments, not prefixes', () => {
    // "/administration" is not part of the admin panel.
    expect(showsOnRoute('/administration')).toBe(true)
    expect(showsOnRoute('/contact-us')).toBe(true)
  })
})
