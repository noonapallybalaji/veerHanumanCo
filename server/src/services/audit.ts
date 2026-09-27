import type { Request } from 'express'
import { prisma } from '../db.js'
import { hashIp, diff } from '../lib/util.js'
import { stringifyJson } from '../lib/json.js'

/**
 * Audit trail for privileged actions.
 *
 * Writes are best-effort: a logging failure must never roll back the action
 * the admin actually performed, so errors are swallowed after being logged
 * to the console.
 *
 * What is deliberately NOT recorded: passwords, tokens, session cookies,
 * raw IP addresses (only a salted hash) and full customer form payloads.
 */
export async function recordAudit(
  req: Request,
  input: {
    action: string
    entityType: string
    entityId?: string | null
    summary: string
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
    reason?: string | null
  },
) {
  try {
    const changes =
      input.before || input.after ? diff(input.before ?? null, input.after ?? null) : null

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id ?? null,
        actorEmail: req.user?.email ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        changes: changes && Object.keys(changes).length > 0 ? stringifyJson(changes) : null,
        reason: input.reason ?? null,
        ipHash: hashIp(req),
      },
    })
  } catch (error) {
    console.error('[audit] failed to record event:', (error as Error).message)
  }
}

/** Records a failed or successful sign-in attempt without the password. */
export async function recordAuthEvent(
  req: Request,
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'ACCOUNT_LOCKED',
  email: string,
  userId?: string | null,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: userId ?? null,
        actorEmail: email.slice(0, 200),
        action,
        entityType: 'AdminUser',
        entityId: userId ?? null,
        summary:
          action === 'LOGIN_FAILED'
            ? 'Failed sign-in attempt'
            : action === 'ACCOUNT_LOCKED'
              ? 'Account temporarily locked after repeated failures'
              : action === 'LOGOUT'
                ? 'Signed out'
                : 'Signed in',
        ipHash: hashIp(req),
      },
    })
  } catch (error) {
    console.error('[audit] failed to record auth event:', (error as Error).message)
  }
}
