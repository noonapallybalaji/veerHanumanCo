import { beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import {
  app,
  post,
  prisma,
  resetTables,
  seedProduct,
  signInAs,
  verifiedVisitor,
  visitorPost,
} from './helpers.js'

const VALID_REVIEW = {
  displayName: 'Ramesh Rao',
  rating: 5,
  title: 'Solid on site',
  body: 'Supplied on time and the chambers were as described. Would use again on the next project.',
  companyName: 'Rao Civil Works',
  consent: true,
}

describe('review submission', () => {
  beforeAll(async () => {
    await resetTables()
  })

  it('accepts a review but never publishes it immediately', async () => {
    const product = await seedProduct({ slug: 'review-target' })

    const response = await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send(VALID_REVIEW)
      .expect(201)

    expect(response.body.status).toBe('PENDING')

    const stored = await prisma.review.findFirst({ where: { productId: product.id } })
    expect(stored?.status).toBe('PENDING')

    // Crucially: not visible publicly yet.
    const publicList = await supertest(app)
      .get(`/api/public/products/${product.slug}/reviews`)
      .expect(200)
    expect(publicList.body.items).toHaveLength(0)
    expect(publicList.body.summary.count).toBe(0)
    expect(publicList.body.summary.average).toBeNull()
  })

  it('records a submission event for the moderation history', async () => {
    const product = await seedProduct({ slug: 'review-events' })
    await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send(VALID_REVIEW)
      .expect(201)

    const review = await prisma.review.findFirst({ where: { productId: product.id } })
    const events = await prisma.reviewEvent.findMany({ where: { reviewId: review!.id } })
    expect(events.map((event) => event.action)).toContain('SUBMITTED')
  })

  it('rejects invalid submissions', async () => {
    const product = await seedProduct({ slug: 'review-validation' })

    await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send({ ...VALID_REVIEW, rating: 9 })
      .expect(422)

    await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send({ ...VALID_REVIEW, body: 'too short' })
      .expect(422)

    // Consent is mandatory.
    await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send({ ...VALID_REVIEW, consent: false })
      .expect(422)
  })

  it('will not attach a review to an unpublished product', async () => {
    const draft = await seedProduct({ slug: 'draft-review-target', status: 'DRAFT' })
    await supertest(app)
      .post(`/api/public/products/${draft.slug}/reviews`)
      .send(VALID_REVIEW)
      .expect(404)
    expect(await prisma.review.count({ where: { productId: draft.id } })).toBe(0)
  })
})

describe('review moderation', () => {
  it('publishes an approved review and counts it in the average', async () => {
    const product = await seedProduct({ slug: 'approve-flow' })
    await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send({ ...VALID_REVIEW, rating: 4 })
      .expect(201)

    const review = await prisma.review.findFirst({ where: { productId: product.id } })
    const moderator = await signInAs('REVIEW_MODERATOR', 'mod1')

    await post(moderator, `/api/admin/reviews/${review!.id}/approve`).expect(200)

    const publicList = await supertest(app).get(`/api/public/products/${product.slug}/reviews`)
    expect(publicList.body.items).toHaveLength(1)
    expect(publicList.body.summary.count).toBe(1)
    expect(publicList.body.summary.average).toBe(4)

    // And it feeds the ratings map used for structured data.
    const content = await supertest(app).get('/api/public/content')
    expect(content.body.ratings[product.id]).toEqual({ average: 4, count: 1 })
  })

  it('keeps rejected and hidden reviews out of public responses and averages', async () => {
    const product = await seedProduct({ slug: 'hidden-flow' })

    for (const rating of [5, 1]) {
      await supertest(app)
        .post(`/api/public/products/${product.slug}/reviews`)
        .send({ ...VALID_REVIEW, rating })
        .expect(201)
    }

    const reviews = await prisma.review.findMany({
      where: { productId: product.id },
      orderBy: { rating: 'desc' },
    })
    const moderator = await signInAs('REVIEW_MODERATOR', 'mod2')

    await post(moderator, `/api/admin/reviews/${reviews[0].id}/approve`).expect(200)
    await post(moderator, `/api/admin/reviews/${reviews[1].id}/reject`)
      .send({ reason: 'Contains a phone number.' })
      .expect(200)

    const publicList = await supertest(app).get(`/api/public/products/${product.slug}/reviews`)
    expect(publicList.body.items).toHaveLength(1)
    // The 1-star rejected review must not drag the average down.
    expect(publicList.body.summary.average).toBe(5)
    expect(JSON.stringify(publicList.body)).not.toContain('Contains a phone number')

    // Hiding the approved one empties the list again.
    await post(moderator, `/api/admin/reviews/${reviews[0].id}/hide`)
      .send({ reason: 'Customer asked us to take it down.' })
      .expect(200)

    const after = await supertest(app).get(`/api/public/products/${product.slug}/reviews`)
    expect(after.body.items).toHaveLength(0)
    expect(after.body.summary.count).toBe(0)
  })

  it('requires a recorded reason to reject or hide', async () => {
    const product = await seedProduct({ slug: 'reason-required' })
    await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send(VALID_REVIEW)
      .expect(201)

    const review = await prisma.review.findFirst({ where: { productId: product.id } })
    const moderator = await signInAs('REVIEW_MODERATOR', 'mod3')

    await post(moderator, `/api/admin/reviews/${review!.id}/reject`).send({}).expect(400)

    const unchanged = await prisma.review.findUnique({ where: { id: review!.id } })
    expect(unchanged?.status).toBe('PENDING')
  })

  it('never exposes internal moderation notes publicly', async () => {
    const product = await seedProduct({ slug: 'internal-note' })
    await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send(VALID_REVIEW)
      .expect(201)

    const review = await prisma.review.findFirst({ where: { productId: product.id } })
    const moderator = await signInAs('REVIEW_MODERATOR', 'mod4')

    await post(moderator, `/api/admin/reviews/${review!.id}/approve`)
      .send({ reason: 'Checked against the order book internally.' })
      .expect(200)

    const publicList = await supertest(app).get(`/api/public/products/${product.slug}/reviews`)
    const payload = JSON.stringify(publicList.body)
    expect(payload).not.toContain('Checked against the order book')
    expect(payload).not.toContain('internalReason')
    expect(payload).not.toContain('submitterIpHash')
    expect(payload).not.toContain('status')
  })

  it('does not let a moderator rewrite the customer text', async () => {
    const product = await seedProduct({ slug: 'immutable-body' })
    await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send(VALID_REVIEW)
      .expect(201)

    const review = await prisma.review.findFirst({ where: { productId: product.id } })
    const moderator = await signInAs('REVIEW_MODERATOR', 'mod5')

    // Approve while attempting to smuggle a new body through.
    await post(moderator, `/api/admin/reviews/${review!.id}/approve`)
      .send({ body: 'Rewritten by the business', rating: 1, displayName: 'Someone else' })
      .expect(200)

    const after = await prisma.review.findUnique({ where: { id: review!.id } })
    expect(after?.body).toBe(VALID_REVIEW.body)
    expect(after?.rating).toBe(VALID_REVIEW.rating)
    expect(after?.displayName).toBe(VALID_REVIEW.displayName)
  })

  it('stops a content editor moderating reviews', async () => {
    const product = await seedProduct({ slug: 'editor-cannot-moderate' })
    await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send(VALID_REVIEW)
      .expect(201)

    const review = await prisma.review.findFirst({ where: { productId: product.id } })
    const editor = await signInAs('CONTENT_EDITOR', 'editor-mod')

    await post(editor, `/api/admin/reviews/${review!.id}/approve`).expect(403)
    expect((await prisma.review.findUnique({ where: { id: review!.id } }))?.status).toBe('PENDING')
  })
})

/**
 * Enquiries now require a verified phone, so each test signs a visitor in
 * through the real OTP flow first. The refusal paths themselves live in
 * otp.test.ts.
 */
describe('enquiries', () => {
  it('stores a submitted enquiry and keeps it out of public responses', async () => {
    const product = await seedProduct({ slug: 'enquiry-product' })
    const visitor = await verifiedVisitor('9876500011', 'Procurement Lead')

    const response = await visitorPost(visitor, '/api/public/enquiries')
      .send({
        name: 'Procurement Lead',
        phone: visitor.phone,
        email: 'buyer@example.com',
        projectType: 'Drainage',
        deliveryLocation: 'Hyderabad',
        items: [{ productName: 'Test Product', productId: product.id, quantity: '250 m' }],
      })
      .expect(201)

    expect(response.body.status).toBe('RECEIVED')
    expect(response.body.reference).toBeTruthy()

    const stored = await prisma.enquiry.findFirst({
      where: { email: 'buyer@example.com' },
      include: { items: true },
    })
    expect(stored?.status).toBe('NEW')
    expect(stored?.items[0]?.productId).toBe(product.id)

    // Customer details must not surface in the public content bundle.
    const content = await supertest(app).get('/api/public/content')
    expect(JSON.stringify(content.body)).not.toContain('buyer@example.com')
  })

  it('validates enquiry input', async () => {
    const visitor = await verifiedVisitor('9876500012', 'Validator')

    await visitorPost(visitor, '/api/public/enquiries').send({ name: 'x' }).expect(422)
    await visitorPost(visitor, '/api/public/enquiries')
      .send({ name: 'Valid Name', phone: 'not-a-number!!' })
      .expect(422)
  })

  it('will not link an enquiry to an unpublished product', async () => {
    const draft = await seedProduct({ slug: 'draft-enquiry-link', status: 'DRAFT' })
    const visitor = await verifiedVisitor('9876500022', 'Prober')

    await visitorPost(visitor, '/api/public/enquiries')
      .send({
        name: 'Prober',
        phone: visitor.phone,
        items: [{ productName: 'Probe', productId: draft.id }],
      })
      .expect(201)

    const item = await prisma.enquiryItem.findFirst({ where: { productName: 'Probe' } })
    // Stored as free text only, so the endpoint cannot confirm draft ids.
    expect(item?.productId).toBeNull()
  })
})
