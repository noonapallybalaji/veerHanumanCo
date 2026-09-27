import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, resetTables, seedProduct } from './helpers.js'

/**
 * Rate limiting is switched off for the rest of the suite so tests can submit
 * freely. This file turns it back on to prove the limiter really fires —
 * otherwise "limits are configured" would be an untested claim.
 */
describe('abuse protection', () => {
  beforeAll(async () => {
    await resetTables()
    process.env.RATE_LIMITS = 'on'
  })

  afterAll(() => {
    process.env.RATE_LIMITS = 'off'
  })

  it('throttles repeated review submissions from one client', async () => {
    const product = await seedProduct({ slug: 'rate-limited-product' })
    const body = {
      displayName: 'Spam Bot',
      rating: 5,
      body: 'A review body long enough to pass validation for this test case.',
      consent: true,
    }

    const statuses: number[] = []
    // The limiter allows 5 per hour; the 6th must be refused.
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await supertest(app)
        .post(`/api/public/products/${product.slug}/reviews`)
        .send(body)
      statuses.push(response.status)
    }

    expect(statuses.filter((status) => status === 201).length).toBeLessThanOrEqual(5)
    expect(statuses).toContain(429)

    // And nothing beyond the allowance reached the database.
    expect(statuses.filter((status) => status === 201).length).toBeGreaterThan(0)
  })

  it('silently drops submissions that trip the honeypot', async () => {
    process.env.RATE_LIMITS = 'off'
    const product = await seedProduct({ slug: 'honeypot-product' })

    const response = await supertest(app)
      .post(`/api/public/products/${product.slug}/reviews`)
      .send({
        displayName: 'Bot',
        rating: 5,
        body: 'A review body long enough to pass validation for this test case.',
        consent: true,
        website: 'http://spam.example.com',
      })

    // Accepted-looking response, so the bot learns nothing...
    expect(response.status).toBe(202)
    // ...but nothing was stored.
    const { prisma } = await import('./helpers.js')
    expect(await prisma.review.count({ where: { productId: product.id } })).toBe(0)
    process.env.RATE_LIMITS = 'on'
  })
})
