import { randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { SignJWT, jwtVerify } from 'jose'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { hashIp } from '../lib/util.js'

/**
 * Session handling.
 *
 * The browser gets an httpOnly, SameSite=Lax cookie containing a signed JWT.
 * The JWT's `jti` is the id of a Session row, and every authenticated
 * request checks that row is still live. That combination gives stateless
 * verification plus real revocation — signing out, or disabling a user,
 * takes effect immediately rather than when the token happens to expire.
 *
 * httpOnly means page scripts cannot read the cookie, so an XSS bug cannot
 * exfiltrate the session.
 */

export const SESSION_COOKIE = 'vh_session'
export const CSRF_COOKIE = 'vh_csrf'

const secret = new TextEncoder().encode(env.AUTH_SECRET)
const ISSUER = 'veerhanuman-cms'

export interface SessionClaims {
  sub: string
  sid: string
  role: string
}

export async function createSession(req: Request, res: Response, userId: string, role: string) {
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000)

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: req.headers['user-agent']?.slice(0, 250) ?? null,
      ipHash: hashIp(req),
    },
  })

  const token = await new SignJWT({ role, sid: session.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .setJti(session.id)
    .sign(secret)

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    expires: expiresAt,
    path: '/',
  })

  // Double-submit CSRF token. Readable by the admin app on purpose — it must
  // echo the value back in a header, which a cross-site page cannot do.
  const csrf = randomBytes(24).toString('base64url')
  res.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    expires: expiresAt,
    path: '/',
  })

  return { session, csrf }
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER })
    if (!payload.sub || !payload.jti) return null
    return { sub: payload.sub, sid: payload.jti, role: String(payload.role ?? '') }
  } catch {
    return null
  }
}

export async function revokeSession(sessionId: string) {
  await prisma.session
    .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
    .catch(() => undefined)
}

export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export function clearSessionCookies(res: Response) {
  const options = { path: '/', sameSite: 'lax' as const, secure: env.COOKIE_SECURE }
  res.clearCookie(SESSION_COOKIE, { ...options, httpOnly: true })
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false })
}

/** Housekeeping so the session table does not grow without bound. */
export async function purgeExpiredSessions() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  await prisma.session.deleteMany({ where: { expiresAt: { lt: cutoff } } })
}
