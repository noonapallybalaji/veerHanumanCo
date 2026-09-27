import { randomBytes } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { SignJWT, jwtVerify } from 'jose'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { ApiError, asyncHandler } from '../lib/errors.js'
import { hashIp } from '../lib/util.js'

/**
 * Visitor (customer) sessions.
 *
 * A deliberate mirror of the admin session code rather than a shared
 * implementation, because the two must never be interchangeable:
 *  - different cookie names, so one cannot be presented as the other
 *  - a different JWT audience, so an admin token fails verification here
 *    and vice versa even though both are signed with AUTH_SECRET
 *  - a different table, so a customer row can never satisfy an admin lookup
 *
 * A customer has no role and no password. The only thing this session
 * asserts is "this browser proved control of this phone number".
 */

export const CUSTOMER_COOKIE = 'vh_customer'
export const CUSTOMER_CSRF_COOKIE = 'vh_customer_csrf'

const secret = new TextEncoder().encode(env.AUTH_SECRET)
const ISSUER = 'veerhanuman-cms'
const AUDIENCE = 'customer'

export interface CustomerPrincipal {
  id: string
  phone: string
  name: string
  sessionId: string
  phoneVerifiedAt: Date | null
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customer?: CustomerPrincipal
    }
  }
}

export async function createCustomerSession(req: Request, res: Response, customerId: string) {
  const expiresAt = new Date(Date.now() + env.CUSTOMER_SESSION_TTL_HOURS * 60 * 60 * 1000)

  const session = await prisma.customerSession.create({
    data: {
      customerId,
      expiresAt,
      userAgent: req.headers['user-agent']?.slice(0, 250) ?? null,
      ipHash: hashIp(req),
    },
  })

  const token = await new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(customerId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .setJti(session.id)
    .sign(secret)

  res.cookie(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    expires: expiresAt,
    path: '/',
  })

  const csrf = randomBytes(24).toString('base64url')
  res.cookie(CUSTOMER_CSRF_COOKIE, csrf, {
    httpOnly: false,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    expires: expiresAt,
    path: '/',
  })

  return { session, csrf }
}

export function clearCustomerCookies(res: Response) {
  const options = { path: '/', sameSite: 'lax' as const, secure: env.COOKIE_SECURE }
  res.clearCookie(CUSTOMER_COOKIE, { ...options, httpOnly: true })
  res.clearCookie(CUSTOMER_CSRF_COOKIE, { ...options, httpOnly: false })
}

export async function revokeCustomerSession(sessionId: string) {
  await prisma.customerSession
    .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
    .catch(() => undefined)
}

/** Resolves the visitor session if present. Never rejects anonymous traffic. */
export const loadCustomer = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[CUSTOMER_COOKIE]
    if (!token) return next()

    let sid: string
    let sub: string
    try {
      const { payload } = await jwtVerify(token, secret, {
        issuer: ISSUER,
        // Rejects an admin token presented on the customer cookie.
        audience: AUDIENCE,
      })
      if (!payload.sub || !payload.jti) return next()
      sid = payload.jti
      sub = payload.sub
    } catch {
      return next()
    }

    const session = await prisma.customerSession.findUnique({
      where: { id: sid },
      include: { customer: true },
    })

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.customerId !== sub ||
      session.customer.isBlocked
    ) {
      return next()
    }

    req.customer = {
      id: session.customer.id,
      phone: session.customer.phone,
      name: session.customer.name,
      sessionId: session.id,
      phoneVerifiedAt: session.customer.phoneVerifiedAt,
    }
    next()
  },
)

/**
 * Requires a signed-in visitor whose phone has actually been verified.
 *
 * This is the gate that makes OTP mandatory for enquiries. The client cannot
 * satisfy it with a flag in a request body — only a cookie backed by a live
 * session row, created solely by a successful OTP verification, will do.
 */
export function requireVerifiedCustomer(req: Request, _res: Response, next: NextFunction) {
  if (!req.customer) {
    return next(
      new ApiError(
        401,
        'VERIFICATION_REQUIRED',
        'Please verify your phone number before sending this enquiry.',
      ),
    )
  }
  if (!req.customer.phoneVerifiedAt) {
    return next(
      new ApiError(403, 'VERIFICATION_REQUIRED', 'Please verify your phone number to continue.'),
    )
  }
  next()
}

/** Double-submit CSRF for visitor-authenticated writes. */
export function requireCustomerCsrf(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()

  const cookieToken = req.cookies?.[CUSTOMER_CSRF_COOKIE]
  const headerToken = req.get('x-customer-csrf-token')

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(
      new ApiError(403, 'CSRF_FAILED', 'Your session could not be verified. Please try again.'),
    )
  }
  next()
}

/**
 * Finds the account for a freshly verified number, or creates one.
 *
 * Phone is unique, so a repeat visitor is logged into the account they
 * already have rather than acquiring a second one. Details supplied at
 * verification time only fill gaps — they never overwrite what the customer
 * already has, so a stranger who happens to type someone's number cannot
 * rewrite that person's name on the account.
 */
export async function upsertVerifiedCustomer(input: {
  phone: string
  name?: string
  email?: string
  company?: string
  marketingConsent?: boolean
}) {
  const existing = await prisma.customer.findUnique({ where: { phone: input.phone } })

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date(),
        name: existing.name || input.name || existing.name,
        email: existing.email ?? (input.email || null),
        company: existing.company ?? (input.company || null),
        // Consent is only ever turned on by an explicit opt-in.
        marketingConsent: input.marketingConsent ? true : existing.marketingConsent,
      },
    })
  }

  return prisma.customer.create({
    data: {
      phone: input.phone,
      name: input.name?.trim() || 'Website visitor',
      email: input.email || null,
      company: input.company || null,
      phoneVerifiedAt: new Date(),
      marketingConsent: Boolean(input.marketingConsent),
    },
  })
}

export async function purgeExpiredCustomerSessions() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await prisma.customerSession.deleteMany({ where: { expiresAt: { lt: cutoff } } })
}
