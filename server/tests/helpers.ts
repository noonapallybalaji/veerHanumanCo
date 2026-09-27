/**
 * Shared test utilities.
 *
 * Environment configuration lives in setup-env.ts, registered as a vitest
 * setupFile. It cannot live here: ESM hoists the imports below, so anything
 * assigned in this file's body runs after server/src/env.ts has already read
 * its configuration.
 */
import supertest from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db.js'
import { hashPassword } from '../src/auth/password.js'

export const app = createApp()

export { prisma }

export interface TestActor {
  agent: TestAgent
  csrf: string
  id: string
  email: string
}

/** Creates a user with the given role and returns a signed-in agent. */
export async function signInAs(role: string, suffix = role.toLowerCase()): Promise<TestActor> {
  const email = `${suffix}@test.local`
  const password = 'Trenchline-Kestrel-2026'

  const user = await prisma.adminUser.upsert({
    where: { email },
    update: { role, isActive: true, failedLogins: 0, lockedUntil: null },
    create: { email, name: `Test ${role}`, role, passwordHash: await hashPassword(password) },
  })

  const agent = supertest.agent(app)
  const response = await agent.post('/api/auth/login').send({ email, password }).expect(200)

  return { agent, csrf: response.body.csrfToken, id: user.id, email }
}

/** Authenticated write helper that attaches the CSRF header. */
export function post(actor: TestActor, url: string) {
  return actor.agent.post(url).set('X-CSRF-Token', actor.csrf)
}

export function put(actor: TestActor, url: string) {
  return actor.agent.put(url).set('X-CSRF-Token', actor.csrf)
}

export function del(actor: TestActor, url: string) {
  return actor.agent.delete(url).set('X-CSRF-Token', actor.csrf)
}

/** Minimal published product, for tests that need something to act on. */
export async function seedProduct(overrides: Record<string, unknown> = {}) {
  const division = await prisma.division.upsert({
    where: { slug: 'products' },
    update: {},
    create: { name: 'Products', slug: 'products' },
  })
  const category = await prisma.category.upsert({
    where: { slug: 'test-family' },
    update: {},
    create: {
      divisionId: division.id,
      name: 'Test Family',
      slug: 'test-family',
      summary: 'A family used by the test suite.',
      description: 'A family used by the test suite, long enough to satisfy validation.',
      visual: 'rcc-chamber',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  })

  const slug = (overrides.slug as string) ?? `test-product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  return prisma.product.create({
    data: {
      categoryId: category.id,
      name: 'Test Product',
      slug,
      summary: 'A product used by the test suite.',
      description: 'A product used by the test suite, long enough to satisfy validation rules.',
      visual: 'rcc-chamber',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      ...overrides,
    },
  })
}

export async function resetTables() {
  // Belt and braces: setup-env.ts already refuses a non-test database, but
  // this function is the destructive one, so it checks for itself.
  const database = process.env.DATABASE_URL?.split('/').pop() ?? ''
  if (!/_test(\?|$)/.test(database)) {
    throw new Error(
      `resetTables() refused: "${database}" is not a test database (name must end in _test).`,
    )
  }

  // Child rows first: SQLite enforces the foreign keys.
  await prisma.reviewReport.deleteMany()
  await prisma.reviewEvent.deleteMany()
  await prisma.review.deleteMany()
  await prisma.enquiryNote.deleteMany()
  await prisma.enquiryItem.deleteMany()
  await prisma.enquiry.deleteMany()
  await prisma.projectProduct.deleteMany()
  await prisma.projectImage.deleteMany()
  await prisma.project.deleteMany()
  await prisma.productApplication.deleteMany()
  await prisma.productRequirementTag.deleteMany()
  await prisma.relatedProduct.deleteMany()
  await prisma.productImage.deleteMany()
  await prisma.productDocument.deleteMany()
  await prisma.product.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.contentVersion.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.otpChallenge.deleteMany()
  await prisma.customerSession.deleteMany()
  await prisma.customer.deleteMany()
}

/**
 * Recovers the plaintext OTP for a number by brute-forcing the stored hash.
 *
 * Deliberately done this way rather than exposing a test hook in the server:
 * it keeps production code free of test affordances, and doubles as proof
 * that the code is stored only as a hash.
 */
export async function recoverOtpCode(e164: string): Promise<string> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone: e164, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (!challenge) throw new Error(`no live OTP challenge for ${e164}`)

  const { createHmac } = await import('node:crypto')
  const secret = process.env.AUTH_SECRET!
  const length = Number(process.env.OTP_LENGTH ?? 6)

  for (let n = 0; n < 10 ** length; n += 1) {
    const candidate = String(n).padStart(length, '0')
    if (
      createHmac('sha256', secret).update(`${e164}:${candidate}`).digest('hex') ===
      challenge.codeHash
    ) {
      return candidate
    }
  }
  throw new Error('could not recover OTP code')
}

export interface VerifiedVisitor {
  agent: TestAgent
  csrf: string
  phone: string
  e164: string
}

/** Signs a visitor in through the real OTP flow and returns their agent. */
export async function verifiedVisitor(
  localPhone: string,
  name = 'Test Visitor',
): Promise<VerifiedVisitor> {
  const e164 = `+91${localPhone}`
  const agent = supertest.agent(app)

  await agent.post('/api/visitor/otp/request').send({ phone: localPhone }).expect(200)
  const response = await agent
    .post('/api/visitor/otp/verify')
    .send({ phone: localPhone, code: await recoverOtpCode(e164), name })
    .expect(200)

  return { agent, csrf: response.body.csrfToken, phone: localPhone, e164 }
}

/** Authenticated enquiry POST, with the visitor CSRF header attached. */
export function visitorPost(visitor: VerifiedVisitor, url: string) {
  return visitor.agent.post(url).set('X-Customer-CSRF-Token', visitor.csrf)
}

export async function ensureCompanyProfile() {
  /*
   * Forces the fixture values on both paths. An `update: {}` here would
   * leave whatever the seed wrote in place, making assertions depend on
   * seeded content — which is how an earlier version of this suite failed
   * confusingly.
   */
  const fixture = {
    companyName: 'Veer Hanuman Trading Co.',
    addressLines: JSON.stringify(['Test address']),
    city: 'Hyderabad',
    state: 'Telangana',
    businessHours: JSON.stringify([{ days: 'Mon-Sat', hours: '9:30 AM - 6:00 PM' }]),
    natureOfBusiness: JSON.stringify(['Wholesaler']),
    proprietor: 'Confidential Proprietor',
    gstin: '36CVMPK9596C1ZY',
    showProprietor: false,
    showGstin: false,
    showWarehouseAddress: false,
    phone: '',
    whatsapp: '',
    email: '',
  }

  await prisma.companyProfile.upsert({
    where: { id: 'singleton' },
    update: fixture,
    create: { id: 'singleton', ...fixture },
  })
}
