import 'dotenv/config'
import { z } from 'zod'

/**
 * Environment validation.
 *
 * The process refuses to start on bad configuration rather than failing
 * later in a request. AUTH_SECRET and IP_HASH_SALT have no defaults on
 * purpose — a shipped default signing key is the same as no signing key.
 */

const booleanish = z
  .string()
  .optional()
  .transform((value) => value === 'true' || value === '1')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL must be a postgresql:// connection string. This project uses Postgres in every environment; a file: URL means a stale .env from the old SQLite setup.',
    ),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5176')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters — generate one, do not invent it'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(24 * 30).default(12),
  IP_HASH_SALT: z.string().min(16, 'IP_HASH_SALT must be at least 16 characters'),
  COOKIE_SECURE: booleanish,

  MEDIA_DRIVER: z.enum(['local']).default('local'),
  MEDIA_LOCAL_DIR: z.string().default('./server/storage'),
  MEDIA_MAX_IMAGE_MB: z.coerce.number().positive().default(8),
  MEDIA_MAX_DOCUMENT_MB: z.coerce.number().positive().default(20),

  BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),

  /* ------------------------------------------------------- OTP / SMS */

  // 'none' is the default on purpose: OTP delivery must be switched on
  // deliberately, and until it is, enquiries are refused rather than
  // accepted unverified.
  SMS_PROVIDER: z.enum(['none', 'console', 'twilio', 'webhook']).default('none'),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),

  SMS_WEBHOOK_URL: z.string().optional(),
  SMS_WEBHOOK_TOKEN: z.string().optional(),

  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
  /** Minimum gap between sends to the same number. */
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(15).max(600).default(45),
  /** Ceiling on sends to one number per hour, regardless of source IP. */
  OTP_MAX_SENDS_PER_HOUR: z.coerce.number().int().min(1).max(50).default(6),

  /** Customer (visitor) session lifetime. Longer than the admin session. */
  CUSTOMER_SESSION_TTL_HOURS: z.coerce.number().int().positive().max(24 * 90).default(720),

  /**
   * Fallback canonical origin for sitemap.xml and robots.txt, used when the
   * CMS company profile has no production URL set. Never derived from the
   * request Host header, which a caller controls.
   */
  PUBLIC_SITE_URL: z.string().optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  // Never print the values themselves — only which keys are wrong.
  console.error(`Invalid environment configuration:\n${issues}\n\nSee .env.example.`)
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

/**
 * The console SMS provider prints codes to the server log. That is a useful
 * development aid and a credential-disclosure bug in production, so refuse
 * to start rather than let it ship by accident.
 */
if (isProduction && env.SMS_PROVIDER === 'console') {
  console.error(
    'SMS_PROVIDER=console prints verification codes to the server log and must not be used in production. Configure twilio or webhook.',
  )
  process.exit(1)
}
