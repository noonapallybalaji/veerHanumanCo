import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckResult } from '../src/startup-checks.js'

/**
 * The production configuration guard.
 *
 * Every case here is a configuration that boots happily in development and is
 * a real security defect once the site is public, so the guard has to refuse
 * to start rather than warn. `env.ts` freezes its parse at import time, hence
 * the reset-modules-and-re-import dance: each case needs its own module graph.
 */

const REAL_SECRET = 'Kq7vXz2mB9pR4tLw8NcJ6yHsE3aUdF5gQ1oZiV0bYnMk'
const REAL_SALT = 'Tj3xW8qLm2ZdR7yBn5Kc9VpH4sGaE6uF'

const BASE: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://vh_app:S9dKm2LqXz7B@db.internal:5432/veerhanuman',
  AUTH_SECRET: REAL_SECRET,
  IP_HASH_SALT: REAL_SALT,
  COOKIE_SECURE: 'true',
  CORS_ORIGINS: 'https://www.example.co.in',
  SMS_PROVIDER: 'twilio',
  TWILIO_ACCOUNT_SID: 'AC00000000000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-value-for-the-test-only',
  TWILIO_FROM: '+15550000000',
  PUBLIC_SITE_URL: 'https://www.example.co.in',
}

/** Snapshot of the suite-wide env, restored after every case. */
let saved: NodeJS.ProcessEnv

beforeEach(() => {
  saved = { ...process.env }
})

afterEach(() => {
  // Restore by mutation: other suites hold a reference to this same object.
  for (const key of Object.keys(process.env)) {
    if (!(key in saved)) delete process.env[key]
  }
  Object.assign(process.env, saved)
  vi.resetModules()
})

async function check(overrides: Record<string, string | undefined> = {}): Promise<CheckResult[]> {
  vi.resetModules()
  for (const [key, value] of Object.entries({ ...BASE, ...overrides })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  const { runStartupChecks } = await import('../src/startup-checks.js')
  return runStartupChecks()
}

const errorsFor = (results: CheckResult[], name: string) =>
  results.filter((result) => result.level === 'error' && result.name === name)

const warningsFor = (results: CheckResult[], name: string) =>
  results.filter((result) => result.level === 'warn' && result.name === name)

describe('startup checks', () => {
  it('passes a correctly configured production environment', async () => {
    const results = await check()
    expect(results.filter((result) => result.level === 'error')).toEqual([])
  })

  it('refuses a placeholder AUTH_SECRET', async () => {
    const results = await check({ AUTH_SECRET: 'change-me-change-me-change-me-change-me' })
    expect(errorsFor(results, 'AUTH_SECRET')).toHaveLength(1)
  })

  it('refuses the value the test suite itself uses', async () => {
    // Guards against someone copying setup-env.ts into a real .env.
    const results = await check({ AUTH_SECRET: 'test-auth-secret-value-at-least-32-chars-long' })
    expect(errorsFor(results, 'AUTH_SECRET')).toHaveLength(1)
  })

  it('refuses a long but low-entropy AUTH_SECRET', async () => {
    const results = await check({ AUTH_SECRET: 'abababababababababababababababababababab' })
    expect(errorsFor(results, 'AUTH_SECRET')).toHaveLength(1)
  })

  it('refuses reusing AUTH_SECRET as the IP hash salt', async () => {
    const results = await check({ IP_HASH_SALT: REAL_SECRET })
    expect(errorsFor(results, 'IP_HASH_SALT')).toHaveLength(1)
  })

  it('refuses COOKIE_SECURE=false in production', async () => {
    const results = await check({ COOKIE_SECURE: 'false' })
    expect(errorsFor(results, 'COOKIE_SECURE')).toHaveLength(1)
  })

  it('refuses non-HTTPS CORS origins in production', async () => {
    const results = await check({ CORS_ORIGINS: 'http://www.example.co.in' })
    expect(errorsFor(results, 'CORS_ORIGINS')).toHaveLength(1)
  })

  it('warns, but does not refuse, when localhost is still allowed', async () => {
    const results = await check({
      CORS_ORIGINS: 'https://www.example.co.in,http://localhost:5173',
    })
    expect(errorsFor(results, 'CORS_ORIGINS')).toHaveLength(0)
    expect(warningsFor(results, 'CORS_ORIGINS')).toHaveLength(1)
  })

  it('warns that enquiries will be refused when SMS is unconfigured', async () => {
    const results = await check({
      SMS_PROVIDER: 'none',
      TWILIO_ACCOUNT_SID: undefined,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_FROM: undefined,
    })
    const warning = warningsFor(results, 'SMS_PROVIDER')
    expect(warning).toHaveLength(1)
    expect(warning[0].message).toMatch(/enquiry forms will be refused/i)
  })

  it('warns when no canonical site URL is configured', async () => {
    const results = await check({ PUBLIC_SITE_URL: undefined })
    expect(warningsFor(results, 'PUBLIC_SITE_URL')).toHaveLength(1)
  })

  it('warns about a default database password', async () => {
    const results = await check({
      DATABASE_URL: 'postgresql://postgres:postgres@db.internal:5432/veerhanuman',
    })
    expect(warningsFor(results, 'DATABASE_URL')).toHaveLength(1)
  })

  it('applies production-only rules only in production', async () => {
    const results = await check({
      NODE_ENV: 'development',
      COOKIE_SECURE: 'false',
      CORS_ORIGINS: 'http://localhost:5176',
      SMS_PROVIDER: 'console',
      PUBLIC_SITE_URL: undefined,
    })
    expect(results.filter((result) => result.level === 'error')).toEqual([])
  })
})
