import type { Request } from 'express'

/**
 * Rate-limit ceilings, resolved per request.
 *
 * express-rate-limit accepts a function for `limit`, which lets the ceiling
 * be decided at request time rather than at import time. The automated tests
 * need to submit far more reviews and enquiries than a real visitor ever
 * would, so they set RATE_LIMITS=off — and one test flips it back on to
 * confirm the limiter still works.
 *
 * The switch is deliberately read from the environment on every call: there
 * is no way to turn limits off from outside the process.
 */
export function limitOf(max: number) {
  return (_req: Request): number => (process.env.RATE_LIMITS === 'off' ? 1_000_000 : max)
}
