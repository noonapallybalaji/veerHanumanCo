import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, ensureCompanyProfile, prisma, resetTables, seedProduct } from './helpers.js'

/**
 * Phone OTP, passwordless login, and the rule that no enquiry is saved
 * without a verified phone.
 *
 * The suite runs with SMS_PROVIDER=console, so codes are generated and
 * stored exactly as in production but delivered to the server log instead of
 * a handset. Tests read the code from the database rather than the log,
 * which also proves the code is stored hashed and never in plain text.
 */

const PHONE = '9876500100'
const E164 = '+919876500100'

/**
 * Recovers the plaintext code by brute-forcing the stored hash over the
 * 10^6 space. Deliberately done this way rather than exposing a test hook
 * in the server: it keeps production code free of test affordances.
 */
async function currentCode(phone = E164): Promise<string> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (!challenge) throw new Error('no live challenge')

  const { createHmac } = await import('node:crypto')
  const secret = process.env.AUTH_SECRET!
  for (let n = 0; n < 1_000_000; n += 1) {
    const candidate = String(n).padStart(6, '0')
    const hash = createHmac('sha256', secret).update(`${phone}:${candidate}`).digest('hex')
    if (hash === challenge.codeHash) return candidate
  }
  throw new Error('could not recover code')
}

beforeAll(async () => {
  process.env.SMS_PROVIDER = 'console'
  await resetTables()
  await ensureCompanyProfile()
})

beforeEach(async () => {
  await prisma.otpChallenge.deleteMany()
})

afterAll(async () => {
  await prisma.customerSession.deleteMany()
  await prisma.customer.deleteMany()
})

describe('otp storage', () => {
  it('never stores the code in plain text', async () => {
    await supertest(app).post('/api/visitor/otp/request').send({ phone: PHONE }).expect(200)

    const challenge = await prisma.otpChallenge.findFirst({ where: { phone: E164 } })
    const code = await currentCode()

    expect(challenge).toBeTruthy()
    expect(challenge!.codeHash).not.toContain(code)
    expect(challenge!.codeHash).toMatch(/^[0-9a-f]{64}$/)
    // And the response body must not leak it either.
    const response = await supertest(app).post('/api/visitor/otp/request').send({ phone: PHONE })
    expect(JSON.stringify(response.body)).not.toContain(code)
  })

  it('normalises the number to E.164', async () => {
    const response = await supertest(app)
      .post('/api/visitor/otp/request')
      .send({ phone: '098765 00100' })
      .expect(200)
    expect(response.body.phone).toBe(E164)
  })

  it('rejects a number that cannot receive SMS', async () => {
    // Too short for the schema (422), and well-formed but not an Indian
    // mobile (400 from normalisation). Both must be refused.
    await supertest(app).post('/api/visitor/otp/request').send({ phone: '12345' }).expect(422)
    await supertest(app).post('/api/visitor/otp/request').send({ phone: '1234567890' }).expect(400)
    await supertest(app).post('/api/visitor/otp/request').send({ phone: '5555555555' }).expect(400)

    expect(await prisma.otpChallenge.count({ where: { phone: { contains: '1234567890' } } })).toBe(0)
  })
})

describe('otp verification', () => {
  it('accepts the correct code and signs the visitor in', async () => {
    const agent = supertest.agent(app)
    await agent.post('/api/visitor/otp/request').send({ phone: PHONE }).expect(200)

    const response = await agent
      .post('/api/visitor/otp/verify')
      .send({ phone: PHONE, code: await currentCode(), name: 'Ramesh Rao' })
      .expect(200)

    expect(response.body.verified).toBe(true)
    expect(response.body.customer.phone).toBe(E164)
    expect(response.body.customer.phoneVerified).toBe(true)

    // The session persists on the same agent.
    const me = await agent.get('/api/visitor/me').expect(200)
    expect(me.body.customer.phone).toBe(E164)
  })

  it('rejects a wrong code and counts the attempt', async () => {
    await supertest(app).post('/api/visitor/otp/request').send({ phone: PHONE }).expect(200)

    const response = await supertest(app)
      .post('/api/visitor/otp/verify')
      .send({ phone: PHONE, code: '000000' })

    // 000000 could in principle be the real code; retry once if so.
    if (response.status === 200) return

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID')

    const challenge = await prisma.otpChallenge.findFirst({ where: { phone: E164 } })
    expect(challenge!.attempts).toBe(1)
  })

  it('burns the challenge after too many wrong attempts', async () => {
    await supertest(app).post('/api/visitor/otp/request').send({ phone: PHONE }).expect(200)
    const real = await currentCode()
    const wrong = real === '111111' ? '222222' : '111111'

    let lastStatus = 0
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await supertest(app)
        .post('/api/visitor/otp/verify')
        .send({ phone: PHONE, code: wrong })
      lastStatus = response.status
    }
    expect(lastStatus).toBe(429)

    // Even the correct code no longer works — the challenge is consumed.
    const after = await supertest(app)
      .post('/api/visitor/otp/verify')
      .send({ phone: PHONE, code: real })
    expect(after.status).toBe(400)
    expect(after.body.error.code).toBe('NO_CHALLENGE')
  })

  it('rejects an expired code', async () => {
    await supertest(app).post('/api/visitor/otp/request').send({ phone: PHONE }).expect(200)
    const code = await currentCode()

    await prisma.otpChallenge.updateMany({
      where: { phone: E164, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const response = await supertest(app)
      .post('/api/visitor/otp/verify')
      .send({ phone: PHONE, code })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('EXPIRED')
  })

  it('will not let one code be used twice', async () => {
    const agent = supertest.agent(app)
    await agent.post('/api/visitor/otp/request').send({ phone: PHONE }).expect(200)
    const code = await currentCode()

    await agent.post('/api/visitor/otp/verify').send({ phone: PHONE, code }).expect(200)

    const replay = await supertest(app).post('/api/visitor/otp/verify').send({ phone: PHONE, code })
    expect(replay.status).toBe(400)
    expect(replay.body.error.code).toBe('NO_CHALLENGE')
  })

  it('supersedes an older code when a new one is sent', async () => {
    await supertest(app).post('/api/visitor/otp/request').send({ phone: PHONE }).expect(200)
    const first = await currentCode()

    // Step past the resend cooldown.
    await prisma.otpChallenge.updateMany({
      where: { phone: E164 },
      data: { lastSentAt: new Date(Date.now() - 10 * 60 * 1000) },
    })
    await supertest(app).post('/api/visitor/otp/request').send({ phone: PHONE }).expect(200)

    const stale = await supertest(app)
      .post('/api/visitor/otp/verify')
      .send({ phone: PHONE, code: first })
    expect(stale.status).toBe(400)

    const fresh = await supertest(app)
      .post('/api/visitor/otp/verify')
      .send({ phone: PHONE, code: await currentCode() })
    expect(fresh.status).toBe(200)
  })
})

describe('otp abuse limits', () => {
  it('enforces a resend cooldown', async () => {
    await supertest(app).post('/api/visitor/otp/request').send({ phone: PHONE }).expect(200)

    const immediate = await supertest(app).post('/api/visitor/otp/request').send({ phone: PHONE })
    expect(immediate.status).toBe(429)
    expect(immediate.body.error.code).toBe('COOLDOWN')
  })

  it('caps the number of codes sent to one number per hour', async () => {
    // Sidestep the cooldown each time so only the hourly ceiling applies.
    let throttled = false
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await supertest(app).post('/api/visitor/otp/request').send({ phone: PHONE })
      if (response.status === 429 && response.body.error.code === 'THROTTLED') {
        throttled = true
        break
      }
      await prisma.otpChallenge.updateMany({
        where: { phone: E164 },
        data: { lastSentAt: new Date(Date.now() - 10 * 60 * 1000) },
      })
    }
    expect(throttled).toBe(true)
  })
})

describe('passwordless accounts', () => {
  it('creates an account for a new number', async () => {
    const phone = '9876500201'
    const agent = supertest.agent(app)
    await agent.post('/api/visitor/otp/request').send({ phone }).expect(200)

    await agent
      .post('/api/visitor/otp/verify')
      .send({ phone, code: await currentCode('+919876500201'), name: 'New Buyer' })
      .expect(200)

    const customer = await prisma.customer.findUnique({ where: { phone: '+919876500201' } })
    expect(customer).toBeTruthy()
    expect(customer!.name).toBe('New Buyer')
    expect(customer!.phoneVerifiedAt).toBeTruthy()
  })

  it('logs an existing number in without creating a duplicate', async () => {
    const phone = '9876500202'
    const e164 = '+919876500202'

    for (const name of ['First Visit', 'Second Visit']) {
      await prisma.otpChallenge.deleteMany()
      const agent = supertest.agent(app)
      await agent.post('/api/visitor/otp/request').send({ phone }).expect(200)
      await agent
        .post('/api/visitor/otp/verify')
        .send({ phone, code: await currentCode(e164), name })
        .expect(200)
    }

    expect(await prisma.customer.count({ where: { phone: e164 } })).toBe(1)
    // The later visit must not rewrite the established name.
    const customer = await prisma.customer.findUnique({ where: { phone: e164 } })
    expect(customer!.name).toBe('First Visit')
  })

  it('keeps marketing consent opt-in and separate', async () => {
    const phone = '9876500203'
    const e164 = '+919876500203'
    const agent = supertest.agent(app)

    await agent.post('/api/visitor/otp/request').send({ phone }).expect(200)
    await agent
      .post('/api/visitor/otp/verify')
      .send({ phone, code: await currentCode(e164), name: 'No Marketing' })
      .expect(200)

    const customer = await prisma.customer.findUnique({ where: { phone: e164 } })
    expect(customer!.marketingConsent).toBe(false)
  })

  it('signs out and invalidates the session', async () => {
    const phone = '9876500204'
    const e164 = '+919876500204'
    const agent = supertest.agent(app)

    await agent.post('/api/visitor/otp/request').send({ phone }).expect(200)
    await agent
      .post('/api/visitor/otp/verify')
      .send({ phone, code: await currentCode(e164), name: 'Sign Out' })
      .expect(200)

    expect((await agent.get('/api/visitor/me')).body.customer).toBeTruthy()

    await agent.post('/api/visitor/logout').expect(200)
    expect((await agent.get('/api/visitor/me')).body.customer).toBeNull()
  })

  it('rejects a revoked session even with the cookie still held', async () => {
    const phone = '9876500205'
    const e164 = '+919876500205'
    const agent = supertest.agent(app)

    await agent.post('/api/visitor/otp/request').send({ phone }).expect(200)
    await agent
      .post('/api/visitor/otp/verify')
      .send({ phone, code: await currentCode(e164), name: 'Revoked' })
      .expect(200)

    await prisma.customerSession.updateMany({ data: { revokedAt: new Date() } })
    expect((await agent.get('/api/visitor/me')).body.customer).toBeNull()
  })

  it('does not accept an admin session as a visitor session', async () => {
    const { signInAs } = await import('./helpers.js')
    const admin = await signInAs('SUPER_ADMIN', 'crossover')

    // The admin cookie must not satisfy the visitor endpoint.
    const me = await admin.agent.get('/api/visitor/me')
    expect(me.body.customer).toBeNull()
  })
})

describe('enquiries require a verified phone', () => {
  it('refuses an anonymous enquiry', async () => {
    const response = await supertest(app)
      .post('/api/public/enquiries')
      .send({ name: 'Unverified Person', phone: '9876500301' })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('VERIFICATION_REQUIRED')
    expect(await prisma.enquiry.count({ where: { name: 'Unverified Person' } })).toBe(0)
  })

  it('cannot be bypassed by claiming verification in the body', async () => {
    const response = await supertest(app).post('/api/public/enquiries').send({
      name: 'Liar',
      phone: '9876500302',
      phoneVerified: true,
      verified: true,
      otpVerified: true,
      customerId: 'made-up',
    })

    expect(response.status).toBe(401)
    expect(await prisma.enquiry.count({ where: { name: 'Liar' } })).toBe(0)
  })

  it('accepts an enquiry once the phone is verified', async () => {
    const phone = '9876500303'
    const e164 = '+919876500303'
    const agent = supertest.agent(app)

    await agent.post('/api/visitor/otp/request').send({ phone }).expect(200)
    const verify = await agent
      .post('/api/visitor/otp/verify')
      .send({ phone, code: await currentCode(e164), name: 'Verified Buyer' })
      .expect(200)

    const product = await seedProduct({ slug: 'otp-enquiry-product' })

    const response = await agent
      .post('/api/public/enquiries')
      .set('X-Customer-CSRF-Token', verify.body.csrfToken)
      .send({
        name: 'Verified Buyer',
        phone,
        projectType: 'Drainage',
        items: [{ productName: 'Test Product', productId: product.id, quantity: '100 m' }],
      })
      .expect(201)

    expect(response.body.status).toBe('RECEIVED')

    const stored = await prisma.enquiry.findFirst({ where: { name: 'Verified Buyer' } })
    expect(stored!.phoneVerified).toBe(true)
    expect(stored!.customerId).toBeTruthy()
    // Stored against the proved number, in normalised form.
    expect(stored!.phone).toBe(e164)
  })

  it('requires the customer CSRF header on the enquiry write', async () => {
    const phone = '9876500304'
    const e164 = '+919876500304'
    const agent = supertest.agent(app)

    await agent.post('/api/visitor/otp/request').send({ phone }).expect(200)
    await agent
      .post('/api/visitor/otp/verify')
      .send({ phone, code: await currentCode(e164), name: 'No Csrf' })
      .expect(200)

    // Session cookie present, CSRF header missing.
    const response = await agent.post('/api/public/enquiries').send({ name: 'No Csrf', phone })
    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('CSRF_FAILED')
  })

  it('refuses an enquiry submitted under a different number', async () => {
    const phone = '9876500305'
    const e164 = '+919876500305'
    const agent = supertest.agent(app)

    await agent.post('/api/visitor/otp/request').send({ phone }).expect(200)
    const verify = await agent
      .post('/api/visitor/otp/verify')
      .send({ phone, code: await currentCode(e164), name: 'Mismatch' })
      .expect(200)

    const response = await agent
      .post('/api/public/enquiries')
      .set('X-Customer-CSRF-Token', verify.body.csrfToken)
      .send({ name: 'Mismatch', phone: '9876599999' })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('PHONE_MISMATCH')
  })

  it('refuses enquiries entirely when SMS is not configured', async () => {
    process.env.SMS_PROVIDER = 'none'
    try {
      const capability = await supertest(app).get('/api/visitor/capability').expect(200)
      expect(capability.body.otpAvailable).toBe(false)

      const otp = await supertest(app).post('/api/visitor/otp/request').send({ phone: '9876500306' })
      expect(otp.status).toBe(503)
      expect(otp.body.error.code).toBe('SMS_UNAVAILABLE')

      // And with no way to verify, the enquiry endpoint stays shut.
      const enquiry = await supertest(app)
        .post('/api/public/enquiries')
        .send({ name: 'No Sms', phone: '9876500306' })
      expect(enquiry.status).toBe(401)
      expect(await prisma.enquiry.count({ where: { name: 'No Sms' } })).toBe(0)
    } finally {
      process.env.SMS_PROVIDER = 'console'
    }
  })

  it('does not create an OTP challenge when sending fails', async () => {
    process.env.SMS_PROVIDER = 'none'
    try {
      await supertest(app).post('/api/visitor/otp/request').send({ phone: '9876500307' })
      expect(
        await prisma.otpChallenge.count({ where: { phone: '+919876500307', consumedAt: null } }),
      ).toBe(0)
    } finally {
      process.env.SMS_PROVIDER = 'console'
    }
  })
})

describe('welcome leads', () => {
  it('saves an unverified lead and flags it as such', async () => {
    const response = await supertest(app)
      .post('/api/visitor/leads')
      .send({
        name: 'Casual Visitor',
        phone: '9876500401',
        requirement: 'Looking for RCC chambers',
        consent: true,
      })
      .expect(201)

    expect(response.body.verified).toBe(false)

    const lead = await prisma.lead.findFirst({ where: { name: 'Casual Visitor' } })
    expect(lead!.isPhoneVerified).toBe(false)
    expect(lead!.customerId).toBeNull()
    expect(lead!.phone).toBe('+919876500401')
  })

  it('marks the lead verified when the session proves the same number', async () => {
    const phone = '9876500402'
    const e164 = '+919876500402'
    const agent = supertest.agent(app)

    await agent.post('/api/visitor/otp/request').send({ phone }).expect(200)
    await agent
      .post('/api/visitor/otp/verify')
      .send({ phone, code: await currentCode(e164), name: 'Verified Lead' })
      .expect(200)

    const response = await agent
      .post('/api/visitor/leads')
      .send({ name: 'Verified Lead', phone, consent: true })
      .expect(201)

    expect(response.body.verified).toBe(true)
    const lead = await prisma.lead.findFirst({ where: { name: 'Verified Lead' } })
    expect(lead!.isPhoneVerified).toBe(true)
    expect(lead!.customerId).toBeTruthy()
  })

  it('does not mark a lead verified for a number the session did not prove', async () => {
    const phone = '9876500403'
    const e164 = '+919876500403'
    const agent = supertest.agent(app)

    await agent.post('/api/visitor/otp/request').send({ phone }).expect(200)
    await agent
      .post('/api/visitor/otp/verify')
      .send({ phone, code: await currentCode(e164), name: 'Owner' })
      .expect(200)

    // Signed in as one number, submitting a lead for another.
    await agent
      .post('/api/visitor/leads')
      .send({ name: 'Someone Else', phone: '9876500499', consent: true })
      .expect(201)

    const lead = await prisma.lead.findFirst({ where: { name: 'Someone Else' } })
    expect(lead!.isPhoneVerified).toBe(false)
    expect(lead!.customerId).toBeNull()
  })

  it('requires the contact consent', async () => {
    await supertest(app)
      .post('/api/visitor/leads')
      .send({ name: 'No Consent', phone: '9876500404' })
      .expect(422)
    expect(await prisma.lead.count({ where: { name: 'No Consent' } })).toBe(0)
  })

  it('keeps marketing consent separate and defaulted off', async () => {
    await supertest(app)
      .post('/api/visitor/leads')
      .send({ name: 'Consent Split', phone: '9876500405', consent: true })
      .expect(201)

    const lead = await prisma.lead.findFirst({ where: { name: 'Consent Split' } })
    expect(lead!.consentAccepted).toBe(true)
    expect(lead!.marketingConsent).toBe(false)
  })
})

describe('admin visibility', () => {
  it('shows lead source and verification status, and hides the IP hash', async () => {
    const { signInAs } = await import('./helpers.js')
    await supertest(app)
      .post('/api/visitor/leads')
      .send({ name: 'Admin Visible', phone: '9876500501', consent: true })
      .expect(201)

    const admin = await signInAs('SUPER_ADMIN', 'leadviewer')
    const response = await admin.agent
      .get('/api/admin/leads')
      .set('X-CSRF-Token', admin.csrf)
      .expect(200)

    const lead = response.body.items.find((row: { name: string }) => row.name === 'Admin Visible')
    expect(lead).toBeTruthy()
    expect(lead.source).toBe('welcome-modal')
    expect(lead.isPhoneVerified).toBe(false)
    expect(JSON.stringify(response.body)).not.toContain('ipHash')
  })

  it('keeps leads away from anonymous callers', async () => {
    await supertest(app).get('/api/admin/leads').expect(401)
  })
})
