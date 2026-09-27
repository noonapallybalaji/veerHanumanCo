import { hash, verify } from '@node-rs/argon2'
import { z } from 'zod'

/**
 * Argon2id password hashing — the current recommendation for password
 * storage. Parameters follow OWASP's guidance (19 MiB memory, 2 passes).
 *
 * @node-rs/argon2 is used instead of the `argon2` package because it ships
 * prebuilt binaries and does not need a native toolchain to install.
 */
const OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
}

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS)
}

export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain)
  } catch {
    // A malformed stored hash must read as "wrong password", never as a crash.
    return false
  }
}

/**
 * Password policy for admin accounts. Length is the dominant factor, so the
 * rule is a 12-character minimum plus a check against the handful of
 * passwords an attacker will always try first.
 */
const OBVIOUS = [
  'password',
  'passw0rd',
  'admin',
  'administrator',
  'welcome',
  'changeme',
  'letmein',
  'qwerty',
  '12345678',
  'veerhanuman',
]

export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(200, 'That password is too long.')
  .refine(
    (value) => !OBVIOUS.some((bad) => value.toLowerCase().includes(bad)),
    'That password is too easy to guess. Avoid common words and the company name.',
  )
  .refine(
    (value) => new Set(value).size >= 5,
    'Use a greater variety of characters.',
  )
