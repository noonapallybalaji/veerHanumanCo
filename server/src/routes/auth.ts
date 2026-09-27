import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { ApiError, asyncHandler } from '../lib/errors.js'
import { hashPassword, passwordSchema, verifyPassword } from '../auth/password.js'
import {
  CSRF_COOKIE,
  clearSessionCookies,
  createSession,
  revokeAllSessions,
  revokeSession,
} from '../auth/session.js'
import { requireAuth, requireCsrf } from '../auth/middleware.js'
import { recordAuthEvent } from '../services/audit.js'
import { limitOf } from '../lib/rateLimit.js'
import { ROLE_PERMISSIONS, type Role } from '../lib/constants.js'

export const authRouter = Router()

/**
 * Sign-in protection is layered:
 *  1. Per-IP rate limit (below) blunts distributed guessing.
 *  2. Per-account lockout (in the handler) stops one account being hammered
 *     from many addresses.
 *  3. Responses are deliberately identical for "no such user", "wrong
 *     password" and "account disabled", so the endpoint cannot be used to
 *     enumerate valid admin emails.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: limitOf(10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    },
  },
})

const MAX_FAILED = 5
const LOCK_MINUTES = 15

const GENERIC_FAILURE = 'Those sign-in details were not recognised.'

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
      password: z.string().min(1, 'Enter your password.'),
    })
    const input = schema.parse(req.body)

    const user = await prisma.adminUser.findUnique({ where: { email: input.email } })

    if (!user || !user.isActive) {
      await recordAuthEvent(req, 'LOGIN_FAILED', input.email, user?.id)
      throw ApiError.unauthorized(GENERIC_FAILURE)
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      throw new ApiError(
        423,
        'ACCOUNT_LOCKED',
        `This account is temporarily locked after repeated failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      )
    }

    const ok = await verifyPassword(user.passwordHash, input.password)

    if (!ok) {
      const failed = user.failedLogins + 1
      const shouldLock = failed >= MAX_FAILED
      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          failedLogins: shouldLock ? 0 : failed,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
        },
      })
      await recordAuthEvent(req, shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED', input.email, user.id)
      throw ApiError.unauthorized(GENERIC_FAILURE)
    }

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    })

    const { csrf } = await createSession(req, res, user.id, user.role)
    await recordAuthEvent(req, 'LOGIN_SUCCESS', user.email, user.id)

    res.json({
      user: publicUser(user),
      csrfToken: csrf,
    })
  }),
)

authRouter.post(
  '/logout',
  requireAuth,
  requireCsrf,
  asyncHandler(async (req, res) => {
    await revokeSession(req.user!.sessionId)
    await recordAuthEvent(req, 'LOGOUT', req.user!.email, req.user!.id)
    clearSessionCookies(res)
    res.json({ ok: true })
  }),
)

/** Who am I — used by the admin app to restore state on reload. */
authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } })

    const user = await prisma.adminUser.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } })

    res.json({
      user: publicUser(user),
      permissions: ROLE_PERMISSIONS[user.role as Role] ?? [],
      csrfToken: req.cookies?.[CSRF_COOKIE] ?? null,
    })
  }),
)

authRouter.post(
  '/change-password',
  requireAuth,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      currentPassword: z.string().min(1, 'Enter your current password.'),
      newPassword: passwordSchema,
    })
    const input = schema.parse(req.body)

    const user = await prisma.adminUser.findUnique({ where: { id: req.user!.id } })
    if (!user) throw ApiError.unauthorized()

    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw ApiError.badRequest('Your current password is not correct.')
    }
    if (await verifyPassword(user.passwordHash, input.newPassword)) {
      throw ApiError.badRequest('Choose a password you have not used here before.')
    }

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword), mustResetPw: false },
    })

    // Changing a password invalidates every other session for the account.
    await revokeAllSessions(user.id)
    clearSessionCookies(res)

    res.json({ ok: true, message: 'Password changed. Please sign in again.' })
  }),
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function publicUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustResetPassword: user.mustResetPw,
    lastLoginAt: user.lastLoginAt,
  }
}
