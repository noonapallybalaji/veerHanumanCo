import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, asyncHandler } from '../../lib/errors.js'
import { ROLES, ROLE_PERMISSIONS } from '../../lib/constants.js'
import { pagination, paged, param } from '../../lib/util.js'
import { requirePermission } from '../../auth/middleware.js'
import { hashPassword, passwordSchema } from '../../auth/password.js'
import { revokeAllSessions } from '../../auth/session.js'
import { recordAudit } from '../../services/audit.js'

export const usersRouter = Router()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shape = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  lockedUntil: user.lockedUntil,
  mustResetPassword: user.mustResetPw,
  createdAt: user.createdAt,
})

usersRouter.get(
  '/',
  requirePermission('user:manage'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } })
    res.json({ users: users.map(shape), roles: ROLES, rolePermissions: ROLE_PERMISSIONS })
  }),
)

usersRouter.post(
  '/',
  requirePermission('user:manage'),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(200),
      name: z.string().trim().min(2, 'Enter a name.').max(120),
      role: z.enum(ROLES),
      password: passwordSchema,
    })
    const input = schema.parse(req.body)

    const user = await prisma.adminUser.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: await hashPassword(input.password),
        // The creator knows this password, so the account must change it.
        mustResetPw: true,
      },
    })

    await recordAudit(req, {
      action: 'ADMIN_USER_CREATED',
      entityType: 'AdminUser',
      entityId: user.id,
      summary: `Created ${input.role} account for ${user.email}`,
    })

    res.status(201).json({ user: shape(user) })
  }),
)

usersRouter.put(
  '/:id',
  requirePermission('user:manage'),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(120),
      role: z.enum(ROLES),
      isActive: z.boolean(),
    })
    const input = schema.parse(req.body)

    const existing = await prisma.adminUser.findUnique({ where: { id: param(req, 'id') } })
    if (!existing) throw ApiError.notFound('User not found.')

    // Guard rails against locking everyone out of the admin panel.
    if (existing.id === req.user!.id && input.role !== existing.role) {
      throw ApiError.badRequest('You cannot change your own role.')
    }
    if (existing.id === req.user!.id && !input.isActive) {
      throw ApiError.badRequest('You cannot deactivate your own account.')
    }
    if (existing.role === 'SUPER_ADMIN' && (input.role !== 'SUPER_ADMIN' || !input.isActive)) {
      const others = await prisma.adminUser.count({
        where: { role: 'SUPER_ADMIN', isActive: true, NOT: { id: existing.id } },
      })
      if (others === 0) {
        throw ApiError.badRequest(
          'This is the last active super admin. Promote another account first.',
        )
      }
    }

    const user = await prisma.adminUser.update({
      where: { id: existing.id },
      data: { name: input.name, role: input.role, isActive: input.isActive },
    })

    // A revoked role or a disabled account must take effect immediately.
    if (existing.role !== input.role || (existing.isActive && !input.isActive)) {
      await revokeAllSessions(user.id)
    }

    await recordAudit(req, {
      action: 'ADMIN_USER_UPDATED',
      entityType: 'AdminUser',
      entityId: user.id,
      summary: `Updated account ${user.email}`,
      before: { role: existing.role, isActive: existing.isActive, name: existing.name },
      after: { role: user.role, isActive: user.isActive, name: user.name },
    })

    res.json({ user: shape(user) })
  }),
)

usersRouter.post(
  '/:id/reset-password',
  requirePermission('user:manage'),
  asyncHandler(async (req, res) => {
    const schema = z.object({ password: passwordSchema })
    const input = schema.parse(req.body)

    const existing = await prisma.adminUser.findUnique({ where: { id: param(req, 'id') } })
    if (!existing) throw ApiError.notFound('User not found.')

    await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        passwordHash: await hashPassword(input.password),
        mustResetPw: true,
        failedLogins: 0,
        lockedUntil: null,
      },
    })
    await revokeAllSessions(existing.id)

    await recordAudit(req, {
      action: 'ADMIN_PASSWORD_RESET',
      entityType: 'AdminUser',
      entityId: existing.id,
      summary: `Reset the password for ${existing.email}`,
    })

    res.json({ ok: true })
  }),
)

usersRouter.post(
  '/:id/unlock',
  requirePermission('user:manage'),
  asyncHandler(async (req, res) => {
    const user = await prisma.adminUser.update({
      where: { id: param(req, 'id') },
      data: { failedLogins: 0, lockedUntil: null },
    })
    await recordAudit(req, {
      action: 'ADMIN_USER_UNLOCKED',
      entityType: 'AdminUser',
      entityId: user.id,
      summary: `Unlocked ${user.email}`,
    })
    res.json({ user: shape(user) })
  }),
)

/* ------------------------------------------------------------- Audit log */

export const auditRouter = Router()

auditRouter.get(
  '/',
  requirePermission('audit:read'),
  asyncHandler(async (req, res) => {
    const params = pagination(req.query as Record<string, unknown>, 50)
    const entityType = String(req.query.entityType ?? '').trim()
    const action = String(req.query.action ?? '').trim()
    const actorId = String(req.query.actorId ?? '').trim()

    const where = {
      ...(entityType ? { entityType } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
      ...(actorId ? { actorId } : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ])

    res.json(paged(rows, total, params))
  }),
)
