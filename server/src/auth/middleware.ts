import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../db.js'
import { ApiError, asyncHandler } from '../lib/errors.js'
import { roleHas, type Permission } from '../lib/constants.js'
import { CSRF_COOKIE, SESSION_COOKIE, verifySessionToken } from './session.js'

/**
 * Authentication and authorisation.
 *
 * These run on the server for every privileged request. Hiding a button in
 * the admin UI is a usability affordance, never the access control — the
 * only thing standing between an anonymous request and the database is this
 * file.
 */

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
  role: string
  sessionId: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

/** Resolves the session if present. Does not reject anonymous requests. */
export const loadUser = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) return next()

  const claims = await verifySessionToken(token)
  if (!claims) return next()

  // The JWT signature alone is not enough: the session must still be live and
  // the account still enabled, so revocation and deactivation apply at once.
  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    include: { user: true },
  })

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    !session.user.isActive ||
    session.userId !== claims.sub
  ) {
    return next()
  }

  req.user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    // Read the role from the database, not the token, so a role change
    // applies immediately instead of at next sign-in.
    role: session.user.role,
    sessionId: session.id,
  }
  next()
})

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized())
  next()
}

/**
 * Route handlers require a capability, not a role, so adding a role later
 * means editing ROLE_PERMISSIONS rather than every endpoint.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized())
    if (!roleHas(req.user.role, permission)) {
      return next(ApiError.forbidden(`This action requires the "${permission}" permission.`))
    }
    next()
  }
}

/**
 * Double-submit CSRF check for cookie-authenticated writes.
 *
 * The session cookie is SameSite=Lax, which already blocks cross-site form
 * posts; this is the second layer. A cross-origin page can cause the cookie
 * to be sent but cannot read it, so it cannot produce the matching header.
 */
export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()

  const cookieToken = req.cookies?.[CSRF_COOKIE]
  const headerToken = req.get('x-csrf-token')

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(
      new ApiError(403, 'CSRF_FAILED', 'Your session could not be verified. Please sign in again.'),
    )
  }
  next()
}
