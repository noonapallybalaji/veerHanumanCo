/**
 * Test environment configuration.
 *
 * Registered as a vitest `setupFile` so it runs BEFORE any test module is
 * imported. This matters: ESM hoists `import` statements, so assigning
 * process.env at the top of a test file happens *after* server/src/env.ts
 * has already read and frozen the configuration — which silently pointed an
 * earlier version of this suite at the development database.
 */
import 'dotenv/config'

process.env.NODE_ENV = 'test'
process.env.AUTH_SECRET = 'test-auth-secret-value-at-least-32-chars-long'
process.env.IP_HASH_SALT = 'test-ip-hash-salt-value'
process.env.CORS_ORIGINS = 'http://localhost:5176'
process.env.MEDIA_LOCAL_DIR = './server/storage-test'

// Rate limits are real in dev and production. They are switched off for the
// suite so tests can submit freely, and one dedicated test turns them back
// on to prove the limiter actually fires. See server/src/lib/rateLimit.ts.
process.env.RATE_LIMITS = 'off'

// OTP tests need a provider that "delivers" without a paid account. The
// console provider generates and stores codes exactly as production does;
// only the transport differs. Tests read the code from the database, so
// production code needs no test-only hooks.
process.env.SMS_PROVIDER = 'console'
process.env.OTP_MAX_SENDS_PER_HOUR = '6'
process.env.OTP_RESEND_COOLDOWN_SECONDS = '45'

/**
 * Point Prisma at the dedicated test database.
 *
 * TEST_DATABASE_URL must be set (see .env.example) — there is no fallback to
 * DATABASE_URL on purpose, because a missing variable would otherwise send a
 * suite that truncates tables straight at the development data.
 */
const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Create a separate Postgres database for the ' +
      'test suite and add it to .env — see .env.example. The suite deletes rows ' +
      'and must never share a database with development.',
  )
}
process.env.DATABASE_URL = testUrl

/**
 * Last line of defence: refuse to run unless the target is unmistakably a
 * test database. This exists because the suite once truncated the real
 * development data during development of this project.
 */
if (!/_test(\?|$)/.test(testUrl.split('/').pop() ?? '')) {
  throw new Error(
    `Refusing to run tests against "${testUrl}". ` +
      'The database name must end in "_test" so a misconfiguration cannot destroy real content.',
  )
}
