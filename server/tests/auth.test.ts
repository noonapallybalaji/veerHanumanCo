import { beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, ensureCompanyProfile, post, prisma, put, seedProduct, signInAs } from './helpers.js'
import { hashPassword } from '../src/auth/password.js'

describe('authentication', () => {
  beforeAll(async () => {
    await ensureCompanyProfile()
  })

  it('rejects an unknown account and a wrong password identically', async () => {
    // Reset the lockout state: this fixture takes one failed attempt per
    // run, and an `update: {}` would let the counter accumulate across runs
    // until the (correctly working) lockout started answering 423 here.
    await prisma.adminUser.upsert({
      where: { email: 'real@test.local' },
      update: { failedLogins: 0, lockedUntil: null, isActive: true },
      create: {
        email: 'real@test.local',
        name: 'Real',
        role: 'SUPER_ADMIN',
        passwordHash: await hashPassword('Trenchline-Kestrel-2026'),
      },
    })

    const unknown = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.local', password: 'Trenchline-Kestrel-2026' })
    const wrongPassword = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'real@test.local', password: 'Wrong-Password-Entirely' })

    expect(unknown.status).toBe(401)
    expect(wrongPassword.status).toBe(401)
    // Identical responses, so the endpoint cannot enumerate admin accounts.
    expect(unknown.body.error.message).toBe(wrongPassword.body.error.message)
  })

  it('never returns the password hash', async () => {
    const actor = await signInAs('SUPER_ADMIN', 'hashcheck')
    const me = await actor.agent.get('/api/auth/me').expect(200)
    expect(JSON.stringify(me.body)).not.toContain('$argon2')
    expect(me.body.user.passwordHash).toBeUndefined()
  })

  it('locks an account after repeated failures', async () => {
    const email = 'lockme@test.local'
    await prisma.adminUser.upsert({
      where: { email },
      update: { failedLogins: 0, lockedUntil: null },
      create: {
        email,
        name: 'Lock Me',
        role: 'CONTENT_EDITOR',
        passwordHash: await hashPassword('Trenchline-Kestrel-2026'),
      },
    })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await supertest(app).post('/api/auth/login').send({ email, password: 'nope-nope-nope' })
    }

    // Even the correct password is refused while the lock is in force.
    const locked = await supertest(app)
      .post('/api/auth/login')
      .send({ email, password: 'Trenchline-Kestrel-2026' })

    expect(locked.status).toBe(423)
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED')

    await prisma.adminUser.update({ where: { email }, data: { lockedUntil: null, failedLogins: 0 } })
  })

  it('signing out revokes the session immediately', async () => {
    const actor = await signInAs('SUPER_ADMIN', 'signout')
    await actor.agent.get('/api/admin/dashboard').set('X-CSRF-Token', actor.csrf).expect(200)

    await post(actor, '/api/auth/logout').expect(200)

    await actor.agent.get('/api/admin/dashboard').set('X-CSRF-Token', actor.csrf).expect(401)
  })

  it('records sign-in events without the password', async () => {
    await signInAs('SUPER_ADMIN', 'audited')
    const entry = await prisma.auditLog.findFirst({
      where: { action: 'LOGIN_SUCCESS', actorEmail: 'audited@test.local' },
      orderBy: { createdAt: 'desc' },
    })
    expect(entry).toBeTruthy()
    expect(JSON.stringify(entry)).not.toContain('Trenchline')
  })
})

describe('authorisation', () => {
  it('refuses anonymous access to every admin route', async () => {
    const routes = [
      '/api/admin/dashboard',
      '/api/admin/catalogue/products',
      '/api/admin/projects',
      '/api/admin/reviews',
      '/api/admin/enquiries',
      '/api/admin/settings/company',
      '/api/admin/users',
      '/api/admin/audit',
    ]
    for (const route of routes) {
      const response = await supertest(app).get(route)
      expect(response.status, `${route} should require auth`).toBe(401)
    }
  })

  it('refuses anonymous writes to the catalogue', async () => {
    const response = await supertest(app)
      .post('/api/admin/catalogue/products')
      .send({ name: 'Injected product' })
    expect(response.status).toBe(401)
    expect(await prisma.product.count({ where: { name: 'Injected product' } })).toBe(0)
  })

  it('rejects a cookie-authenticated write without the CSRF header', async () => {
    const actor = await signInAs('SUPER_ADMIN', 'csrf')
    // Same agent (cookies attached), but no X-CSRF-Token.
    const response = await actor.agent.post('/api/admin/catalogue/products').send({})
    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('CSRF_FAILED')
  })

  it('stops a content editor publishing', async () => {
    const product = await seedProduct({ status: 'DRAFT' })
    const editor = await signInAs('CONTENT_EDITOR')

    const response = await post(editor, `/api/admin/catalogue/products/${product.id}/publish`)
    expect(response.status).toBe(403)

    const after = await prisma.product.findUnique({ where: { id: product.id } })
    expect(after?.status).toBe('DRAFT')
  })

  it('lets a content editor submit for review instead', async () => {
    const product = await seedProduct({ status: 'DRAFT' })
    const editor = await signInAs('CONTENT_EDITOR')

    await post(editor, `/api/admin/catalogue/products/${product.id}/submit`).expect(200)
    const after = await prisma.product.findUnique({ where: { id: product.id } })
    expect(after?.status).toBe('IN_REVIEW')
  })

  it('stops a review moderator touching company settings or users', async () => {
    const moderator = await signInAs('REVIEW_MODERATOR')
    await put(moderator, '/api/admin/settings/company').send({ companyName: 'Hacked' }).expect(403)
    await moderator.agent.get('/api/admin/users').set('X-CSRF-Token', moderator.csrf).expect(403)
    await moderator.agent.get('/api/admin/audit').set('X-CSRF-Token', moderator.csrf).expect(403)
  })

  it('applies a role change to existing sessions immediately', async () => {
    const victim = await signInAs('SUPER_ADMIN', 'demoted')
    const admin = await signInAs('SUPER_ADMIN', 'promoter')

    await put(admin, `/api/admin/users/${victim.id}`)
      .send({ name: 'Demoted', role: 'REVIEW_MODERATOR', isActive: true })
      .expect(200)

    // The old session is revoked, so it cannot keep using super-admin rights.
    const response = await victim.agent.get('/api/admin/users').set('X-CSRF-Token', victim.csrf)
    expect(response.status).toBe(401)
  })
})
