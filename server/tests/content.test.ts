import { beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import {
  app,
  ensureCompanyProfile,
  post,
  prisma,
  put,
  resetTables,
  seedProduct,
  signInAs,
} from './helpers.js'

/**
 * The central guarantee of the CMS: the public API returns published content
 * and nothing else. These tests attack that boundary from the outside.
 */
describe('public content visibility', () => {
  beforeAll(async () => {
    await resetTables()
    await ensureCompanyProfile()
  })

  it('returns published products', async () => {
    const product = await seedProduct({ slug: 'visible-product', name: 'Visible Product' })
    const response = await supertest(app).get('/api/public/content').expect(200)

    expect(response.body.products.some((p: { id: string }) => p.id === product.id)).toBe(true)
  })

  it('hides draft, in-review and archived products', async () => {
    const draft = await seedProduct({ slug: 'a-draft', name: 'Secret Draft', status: 'DRAFT' })
    const review = await seedProduct({ slug: 'in-review', name: 'In Review', status: 'IN_REVIEW' })
    const archived = await seedProduct({ slug: 'archived', name: 'Archived', status: 'ARCHIVED' })

    const response = await supertest(app).get('/api/public/content').expect(200)
    const ids = response.body.products.map((p: { id: string }) => p.id)

    expect(ids).not.toContain(draft.id)
    expect(ids).not.toContain(review.id)
    expect(ids).not.toContain(archived.id)
    // Not even the name should appear anywhere in the payload.
    expect(JSON.stringify(response.body)).not.toContain('Secret Draft')
  })

  it('unpublishing removes a product from the public API', async () => {
    const product = await seedProduct({ slug: 'to-unpublish', name: 'Going Offline' })
    const admin = await signInAs('SUPER_ADMIN', 'publisher')

    let response = await supertest(app).get('/api/public/content')
    expect(response.body.products.some((p: { id: string }) => p.id === product.id)).toBe(true)

    await post(admin, `/api/admin/catalogue/products/${product.id}/unpublish`).expect(200)

    response = await supertest(app).get('/api/public/content')
    expect(response.body.products.some((p: { id: string }) => p.id === product.id)).toBe(false)
  })

  it('publishing makes a draft appear without a redeploy', async () => {
    const product = await seedProduct({ slug: 'to-publish', name: 'Coming Online', status: 'DRAFT' })
    const admin = await signInAs('SUPER_ADMIN', 'publisher2')

    await post(admin, `/api/admin/catalogue/products/${product.id}/publish`).expect(200)

    const response = await supertest(app).get('/api/public/content')
    expect(response.body.products.some((p: { id: string }) => p.id === product.id)).toBe(true)
  })

  it('hides unconfirmed additional offerings', async () => {
    await prisma.additionalOffering.deleteMany()
    await prisma.additionalOffering.create({
      data: {
        name: 'Unconfirmed Coal Supply',
        type: 'product',
        status: 'CONFIRMATION_REQUIRED',
        source: 'third-party directory',
        note: 'Not confirmed by the owner.',
      },
    })

    const response = await supertest(app).get('/api/public/content').expect(200)
    expect(response.body.additionalOfferings).toHaveLength(0)
    expect(JSON.stringify(response.body)).not.toContain('Unconfirmed Coal Supply')
    // The internal status must never be exposed either.
    expect(JSON.stringify(response.body)).not.toContain('CONFIRMATION_REQUIRED')
  })

  it('withholds the proprietor and GSTIN until they are switched on', async () => {
    await prisma.companyProfile.update({
      where: { id: 'singleton' },
      data: { showProprietor: false, showGstin: false },
    })

    let response = await supertest(app).get('/api/public/content').expect(200)
    expect(response.body.company.proprietor).toBe('')
    expect(response.body.company.gstin).toBe('')
    expect(JSON.stringify(response.body)).not.toContain('Confidential Proprietor')

    await prisma.companyProfile.update({
      where: { id: 'singleton' },
      data: { showProprietor: true, showGstin: true },
    })

    response = await supertest(app).get('/api/public/content')
    expect(response.body.company.proprietor).toBe('Confidential Proprietor')
    expect(response.body.company.gstin).toBe('36CVMPK9596C1ZY')

    await prisma.companyProfile.update({
      where: { id: 'singleton' },
      data: { showProprietor: false, showGstin: false },
    })
  })

  it('serves a contact change from one place', async () => {
    const admin = await signInAs('SUPER_ADMIN', 'contactedit')
    const current = (await admin.agent.get('/api/admin/settings/company').set('X-CSRF-Token', admin.csrf)).body
      .company

    await put(admin, '/api/admin/settings/company')
      .send({
        ...current,
        addressLines: current.address.lines,
        city: current.address.city,
        state: current.address.state,
        postalCode: current.address.postalCode,
        country: current.address.country,
        addressLabel: current.address.label,
        warehouseLabel: current.warehouseAddress.label,
        warehouseLines: current.warehouseAddress.lines,
        phone: '919876543210',
        whatsapp: '919876543210',
        email: 'enquiry@example.com',
      })
      .expect(200)

    const response = await supertest(app).get('/api/public/content').expect(200)
    expect(response.body.company.phone).toBe('919876543210')
    expect(response.body.company.email).toBe('enquiry@example.com')
  })
})

describe('public project visibility', () => {
  it('hides unpublished projects and their private fields', async () => {
    const draft = await prisma.project.create({
      data: {
        title: 'Unpublished Project',
        slug: 'unpublished-project',
        summary: 'Should never be public.',
        description: 'A draft project used by the test suite.',
        status: 'DRAFT',
        clientName: 'Private Client Ltd',
        clientPublishable: false,
      },
    })

    const content = await supertest(app).get('/api/public/content').expect(200)
    expect(JSON.stringify(content.body)).not.toContain('Unpublished Project')
    expect(JSON.stringify(content.body)).not.toContain('Private Client Ltd')

    await supertest(app).get(`/api/public/projects/${draft.slug}`).expect(404)
  })

  it('withholds a client name that has not been cleared for publication', async () => {
    await prisma.project.create({
      data: {
        title: 'Published Project',
        slug: 'published-project',
        summary: 'A published project.',
        description: 'A published project used by the test suite.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        clientName: 'Unconsented Client Ltd',
        clientPublishable: false,
        testimonialQuote: 'An unapproved testimonial.',
        testimonialConsent: false,
      },
    })

    const response = await supertest(app).get('/api/public/projects/published-project').expect(200)

    expect(response.body.project.title).toBe('Published Project')
    // Consent gates both of these server-side.
    expect(response.body.project.client).toBeNull()
    expect(response.body.project.testimonial).toBeNull()
    expect(JSON.stringify(response.body)).not.toContain('Unconsented Client Ltd')
    expect(JSON.stringify(response.body)).not.toContain('An unapproved testimonial')
  })
})

describe('catalogue integrity', () => {
  it('refuses to delete a product that is still referenced', async () => {
    const product = await seedProduct({ slug: 'referenced', name: 'Referenced Product' })
    await prisma.review.create({
      data: {
        productId: product.id,
        displayName: 'Tester',
        rating: 5,
        body: 'A review long enough to pass validation rules for the suite.',
        status: 'APPROVED',
        publishedAt: new Date(),
      },
    })

    const admin = await signInAs('SUPER_ADMIN', 'deleter')
    const response = await admin.agent
      .delete(`/api/admin/catalogue/products/${product.id}`)
      .set('X-CSRF-Token', admin.csrf)

    expect(response.status).toBe(409)
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeTruthy()
  })

  it('writes an audit entry when content is published', async () => {
    const product = await seedProduct({ slug: 'audited-publish', status: 'DRAFT' })
    const admin = await signInAs('SUPER_ADMIN', 'auditor')

    await post(admin, `/api/admin/catalogue/products/${product.id}/publish`).expect(200)

    const entry = await prisma.auditLog.findFirst({
      where: { entityType: 'Product', entityId: product.id, action: 'PRODUCT_PUBLISH' },
    })
    expect(entry).toBeTruthy()
    expect(entry?.actorEmail).toBe('auditor@test.local')
  })
})
