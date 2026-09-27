import { env, isProduction } from './env.js'
import { smsConfigured, smsProviderName } from './sms/index.js'

/**
 * Production configuration guard.
 *
 * `env.ts` validates that variables are well-formed. This goes further and
 * asks whether the resulting configuration is *safe to expose to the public*.
 * Every check here is something that boots perfectly well in development and
 * is a real defect in production, so the failure mode is a refusal to start
 * rather than a warning nobody reads.
 *
 * Called from server/src/index.ts before the listener opens.
 */

export interface CheckResult {
  name: string
  level: 'error' | 'warn'
  message: string
}

/** Placeholder values that must never reach production. */
const PLACEHOLDER_SECRETS = [
  'change-me',
  'changeme',
  'secret',
  'test-auth-secret-value-at-least-32-chars-long',
  'your-secret-here',
  'replace-me',
]

function looksLikePlaceholder(value: string): boolean {
  const lower = value.toLowerCase()
  return PLACEHOLDER_SECRETS.some((bad) => lower.includes(bad))
}

/**
 * Rough entropy check. A 32-character string of one repeated word passes a
 * length test but is trivially guessable.
 */
function hasWeakEntropy(value: string): boolean {
  return new Set(value).size < 16
}

export function runStartupChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const fail = (name: string, message: string) =>
    results.push({ name, level: 'error', message })
  const warn = (name: string, message: string) => results.push({ name, level: 'warn', message })

  /* ------------------------------------------------------- secrets */

  if (looksLikePlaceholder(env.AUTH_SECRET)) {
    fail('AUTH_SECRET', 'is a placeholder value. Generate a real one and restart.')
  } else if (hasWeakEntropy(env.AUTH_SECRET)) {
    fail('AUTH_SECRET', 'has too little variety to be a real random secret.')
  }

  if (looksLikePlaceholder(env.IP_HASH_SALT)) {
    fail('IP_HASH_SALT', 'is a placeholder value. Generate a real one and restart.')
  }

  if (env.AUTH_SECRET === env.IP_HASH_SALT) {
    fail('IP_HASH_SALT', 'must not be the same value as AUTH_SECRET.')
  }

  /* ------------------------------------------ production-only rules */

  if (isProduction) {
    if (!env.COOKIE_SECURE) {
      fail(
        'COOKIE_SECURE',
        'must be true in production. Without it, session cookies are sent over plain HTTP and can be stolen in transit.',
      )
    }

    if (env.SMS_PROVIDER === 'console') {
      fail(
        'SMS_PROVIDER',
        'is "console", which prints verification codes to the server log. Configure twilio or webhook.',
      )
    }

    if (!smsConfigured()) {
      // Not fatal: the site still serves content, but no enquiry can be
      // submitted, so make the consequence impossible to miss.
      warn(
        'SMS_PROVIDER',
        `is "${smsProviderName()}" with no usable credentials. Phone verification is unavailable, so ALL enquiry forms will be refused until it is configured.`,
      )
    }

    const insecureOrigins = env.CORS_ORIGINS.filter(
      (origin) => origin.startsWith('http://') && !origin.includes('localhost'),
    )
    if (insecureOrigins.length > 0) {
      fail(
        'CORS_ORIGINS',
        `contains non-HTTPS origins in production: ${insecureOrigins.join(', ')}`,
      )
    }

    if (env.CORS_ORIGINS.some((origin) => origin.includes('localhost'))) {
      warn('CORS_ORIGINS', 'still allows localhost. Remove it from the production list.')
    }

    if (!env.PUBLIC_SITE_URL) {
      // The CMS company profile can supply this instead, so it is a warning.
      warn(
        'PUBLIC_SITE_URL',
        'is not set. sitemap.xml and robots.txt will fall back to the CMS company profile, and return 503 if that is empty too.',
      )
    }

    if (env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1')) {
      warn(
        'DATABASE_URL',
        'points at localhost. That is correct only if Postgres runs on this same host.',
      )
    }

    if (/(^|:)(postgres|password|dev|test)@/.test(env.DATABASE_URL)) {
      warn('DATABASE_URL', 'appears to use a default or weak database password.')
    }
  }

  /* ----------------------------------------------- always-on sanity */

  if (env.SESSION_TTL_HOURS > 24 * 7) {
    warn('SESSION_TTL_HOURS', 'is longer than a week; consider shortening admin sessions.')
  }

  return results
}

/**
 * Runs the checks and reports. Exits non-zero on any error so a bad deploy
 * fails at start rather than serving insecurely.
 */
export function enforceStartupChecks(): void {
  const results = runStartupChecks()
  const errors = results.filter((result) => result.level === 'error')
  const warnings = results.filter((result) => result.level === 'warn')

  for (const warning of warnings) {
    console.warn(`[startup] WARNING  ${warning.name} ${warning.message}`)
  }

  if (errors.length > 0) {
    console.error('\n[startup] Refusing to start. Fix the following configuration problems:\n')
    for (const error of errors) {
      console.error(`  - ${error.name} ${error.message}`)
    }
    console.error('\nSee .env.example and DEPLOYMENT.md.\n')
    process.exit(1)
  }

  console.log(
    `[startup] configuration checks passed (${warnings.length} warning${warnings.length === 1 ? '' : 's'})`,
  )
}
