import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, ensureCompanyProfile, post, prisma, resetTables, seedProduct, signInAs } from './helpers.js'

/**
 * Dynamic sitemap.
 *
 * The behaviour that matters: published content is listed, unpublished
 * content is not, and a publish shows up on the very next request without a
 * frontend rebuild.
 */

const ORIGIN = 'https://www.veerhanumantrading.com'

async function setOrigin(value: string) {
  await prisma.companyProfile.update({
    where: { id: 'singleton' },
    data: { siteUrl: value },
  })
}

async function fetchSitemap() {
  const response = await supertest(app).get('/sitemap.xml')
  return { status: response.status, xml: response.text, headers: response.headers }
}

beforeAll(async () => {
  await resetTables()
  await ensureCompanyProfile()
  await setOrigin(ORIGIN)
})

beforeEach(async () => {
  await prisma.project.deleteMany()
})

describe('sitemap basics', () => {
  it('returns valid XML with the right content type and cache headers', async () => {
    const { status, xml, headers } = await fetchSitemap()

    expect(status).toBe(200)
    expect(headers['content-type']).toContain('application/xml')
    expect(headers['cache-control']).toContain('max-age')
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)

    // Every <url> is closed and carries a <loc>.
    const opens = (xml.match(/<url>/g) ?? []).length
    const closes = (xml.match(/<\/url>/g) ?? []).length
    const locs = (xml.match(/<loc>/g) ?? []).length
    expect(opens).toBe(closes)
    expect(locs).toBe(opens)
  })

  it('lists the canonical public pages', async () => {
    const { xml } = await fetchSitemap()
    for (const path of ['/', '/products', '/services', '/projects', '/about', '/contact', '/request-quote']) {
      expect(xml, `expected ${path}`).toContain(`<loc>${ORIGIN}${path}</loc>`)
    }
  })

  it('uses the configured origin, never the request host', async () => {
    const response = await supertest(app)
      .get('/sitemap.xml')
      .set('Host', 'evil.example.com')
      .set('X-Forwarded-Host', 'evil.example.com')

    expect(response.text).not.toContain('evil.example.com')
    expect(response.text).toContain(ORIGIN)
  })

  it('excludes admin and API routes', async () => {
    const { xml } = await fetchSitemap()
    expect(xml).not.toContain('/admin')
    expect(xml).not.toContain('/api/')
  })

  it('refuses rather than guessing when no origin is configured', async () => {
    await setOrigin('')
    try {
      const response = await supertest(app).get('/sitemap.xml')
      expect(response.status).toBe(503)
      // No internals, no guessed host.
      expect(response.text).not.toContain('localhost')
      expect(response.text.toLowerCase()).not.toContain('prisma')
    } finally {
      await setOrigin(ORIGIN)
    }
  })

  it('ignores a malformed configured origin', async () => {
    await setOrigin('not-a-url')
    try {
      expect((await supertest(app).get('/sitemap.xml')).status).toBe(503)
    } finally {
      await setOrigin(ORIGIN)
    }
  })

  it('normalises an origin that includes a path', async () => {
    await setOrigin('https://example.com/some/path?x=1')
    try {
      const { xml } = await fetchSitemap()
      expect(xml).toContain('<loc>https://example.com/</loc>')
      expect(xml).not.toContain('/some/path')
    } finally {
      await setOrigin(ORIGIN)
    }
  })
})

describe('published products and categories', () => {
  it('includes published products under their category slug', async () => {
    const product = await seedProduct({ slug: 'sitemap-visible-product' })
    const category = await prisma.category.findUnique({ where: { id: product.categoryId } })

    const { xml } = await fetchSitemap()
    expect(xml).toContain(`<loc>${ORIGIN}/products/${category!.slug}/sitemap-visible-product</loc>`)
    expect(xml).toContain(`<loc>${ORIGIN}/products/${category!.slug}</loc>`)
  })

  it('excludes draft and archived products', async () => {
    await seedProduct({ slug: 'sitemap-draft-product', status: 'DRAFT' })
    await seedProduct({ slug: 'sitemap-archived-product', status: 'ARCHIVED' })

    const { xml } = await fetchSitemap()
    expect(xml).not.toContain('sitemap-draft-product')
    expect(xml).not.toContain('sitemap-archived-product')
  })

  it('omits a published product whose family is unpublished', async () => {
    // Upserts: resetTables() deliberately leaves taxonomy and categories in
    // place, so these fixtures must survive a second run of the suite.
    const hidden = await prisma.category.upsert({
      where: { slug: 'hidden-family' },
      update: { status: 'DRAFT' },
      create: {
        divisionId: (await prisma.division.findFirst())!.id,
        name: 'Hidden Family',
        slug: 'hidden-family',
        summary: 'A family used by the sitemap tests.',
        description: 'A family used by the sitemap tests, long enough to validate.',
        visual: 'rcc-chamber',
        status: 'DRAFT',
      },
    })
    await prisma.product.upsert({
      where: { slug: 'sitemap-orphan-product' },
      update: { categoryId: hidden.id, status: 'PUBLISHED' },
      create: {
        categoryId: hidden.id,
        name: 'Orphan Product',
        slug: 'sitemap-orphan-product',
        summary: 'Published, but unreachable.',
        description: 'Published inside an unpublished family, so it has no reachable URL.',
        visual: 'rcc-chamber',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    const { xml } = await fetchSitemap()
    // Reachable-URL rule: no family page, so no product page either.
    expect(xml).not.toContain('sitemap-orphan-product')
    expect(xml).not.toContain('hidden-family')
  })
})

describe('projects', () => {
  it('handles an empty project list without breaking', async () => {
    expect(await prisma.project.count()).toBe(0)

    const { status, xml } = await fetchSitemap()
    expect(status).toBe(200)
    // The listing page is still there; no project detail URLs are.
    expect(xml).toContain(`<loc>${ORIGIN}/projects</loc>`)
    expect(xml).not.toContain('/projects/')
  })

  it('includes published projects by their canonical slug', async () => {
    await prisma.project.create({
      data: {
        title: 'KGN Constructions',
        slug: 'kgn-constructions',
        summary: 'Bridge and road infrastructure.',
        description: 'A published project reference used by the sitemap tests.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    const { xml } = await fetchSitemap()
    expect(xml).toContain(`<loc>${ORIGIN}/projects/kgn-constructions</loc>`)
  })

  it('excludes draft and archived projects', async () => {
    await prisma.project.create({
      data: {
        title: 'Secret Draft Project',
        slug: 'sitemap-draft-project',
        summary: 'Should never be listed.',
        description: 'A draft project used by the sitemap tests.',
        status: 'DRAFT',
      },
    })
    await prisma.project.create({
      data: {
        title: 'Archived Project',
        slug: 'sitemap-archived-project',
        summary: 'Should never be listed.',
        description: 'An archived project used by the sitemap tests.',
        status: 'ARCHIVED',
      },
    })

    const { xml } = await fetchSitemap()
    expect(xml).not.toContain('sitemap-draft-project')
    expect(xml).not.toContain('sitemap-archived-project')
    // Nor should the title leak.
    expect(xml).not.toContain('Secret Draft Project')
  })

  /**
   * The point of the whole exercise: a publish is reflected on the next
   * request, with no frontend build in between.
   */
  it('reflects a newly published project without a rebuild', async () => {
    const project = await prisma.project.create({
      data: {
        title: 'Later Project',
        slug: 'published-later',
        summary: 'Published after the first fetch.',
        description: 'Used to prove the sitemap is generated per request.',
        status: 'DRAFT',
      },
    })

    const before = await fetchSitemap()
    expect(before.xml).not.toContain('published-later')

    // Publish through the real admin endpoint, not a direct DB write.
    const admin = await signInAs('SUPER_ADMIN', 'sitemapadmin')
    await post(admin, `/api/admin/projects/${project.id}/publish`).expect(200)

    const after = await fetchSitemap()
    expect(after.xml).toContain(`<loc>${ORIGIN}/projects/published-later</loc>`)
  })

  it('drops a project again when it is unpublished', async () => {
    const project = await prisma.project.create({
      data: {
        title: 'Temporarily Live',
        slug: 'temporarily-live',
        summary: 'Goes offline again.',
        description: 'Used to prove unpublishing removes the URL.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    expect((await fetchSitemap()).xml).toContain('temporarily-live')

    const admin = await signInAs('SUPER_ADMIN', 'sitemapadmin2')
    await post(admin, `/api/admin/projects/${project.id}/unpublish`).expect(200)

    expect((await fetchSitemap()).xml).not.toContain('temporarily-live')
  })
})

describe('xml escaping', () => {
  it('escapes characters that would otherwise break the document', async () => {
    // Slugs are generated, but the renderer must not depend on that.
    await prisma.project.create({
      data: {
        title: 'Ampersand Project',
        slug: 'road-&-drainage<test>',
        summary: 'Exercises XML escaping.',
        description: 'A project whose slug contains XML-significant characters.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    const { xml } = await fetchSitemap()
    expect(xml).toContain('road-&amp;-drainage&lt;test&gt;')
    // A raw & or < inside <loc> would make the document invalid.
    expect(xml).not.toMatch(/<loc>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)/)
    expect(xml).not.toContain('<loc>https://www.veerhanumantrading.com/projects/road-&-')
  })
})

describe('robots.txt', () => {
  it('points at the sitemap and blocks private areas', async () => {
    const response = await supertest(app).get('/robots.txt').expect(200)

    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.text).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
    expect(response.text).toContain('Disallow: /admin')
    expect(response.text).toContain('Disallow: /api/')
    expect(response.text).toContain('User-agent: *')
  })

  it('omits the sitemap line when no origin is configured', async () => {
    await setOrigin('')
    try {
      const response = await supertest(app).get('/robots.txt').expect(200)
      // Still serves a valid file; just makes no claim it cannot support.
      expect(response.text).toContain('User-agent: *')
      expect(response.text).not.toContain('Sitemap:')
    } finally {
      await setOrigin(ORIGIN)
    }
  })
})
