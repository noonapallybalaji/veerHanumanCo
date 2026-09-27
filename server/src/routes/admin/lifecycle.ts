import type { Request } from 'express'
import { ApiError } from '../../lib/errors.js'
import { roleHas } from '../../lib/constants.js'

/**
 * Shared draft -> published -> archived transitions.
 *
 * Kept in one place so products, projects, services and pages cannot drift
 * apart on what "publish" means, and so the permission rule is applied
 * identically everywhere: an editor may move content to IN_REVIEW, but only
 * someone with content:publish can make it live.
 */

export type Transition = 'publish' | 'unpublish' | 'submit' | 'request-changes' | 'archive' | 'restore'

export interface LifecycleResult {
  status: string
  publishedAt?: Date | null
  archivedAt?: Date | null
}

export function applyTransition(req: Request, current: string, action: Transition): LifecycleResult {
  const canPublish = roleHas(req.user?.role ?? '', 'content:publish')
  const now = new Date()

  switch (action) {
    case 'submit':
      if (current === 'PUBLISHED') {
        throw ApiError.badRequest('This is already published.')
      }
      return { status: 'IN_REVIEW' }

    case 'request-changes':
      if (!canPublish) throw ApiError.forbidden('Only a publisher can request changes.')
      return { status: 'CHANGES_REQUESTED' }

    case 'publish':
      if (!canPublish) {
        throw ApiError.forbidden(
          'Your role can save and submit drafts, but not publish. Submit it for review instead.',
        )
      }
      if (current === 'ARCHIVED') {
        throw ApiError.badRequest('Restore this from the archive before publishing it.')
      }
      return { status: 'PUBLISHED', publishedAt: now, archivedAt: null }

    case 'unpublish':
      if (!canPublish) throw ApiError.forbidden('Your role cannot unpublish content.')
      if (current !== 'PUBLISHED') throw ApiError.badRequest('This is not currently published.')
      return { status: 'DRAFT', publishedAt: null }

    case 'archive':
      if (!canPublish) throw ApiError.forbidden('Your role cannot archive content.')
      return { status: 'ARCHIVED', archivedAt: now, publishedAt: null }

    case 'restore':
      if (!canPublish) throw ApiError.forbidden('Your role cannot restore content.')
      if (current !== 'ARCHIVED') throw ApiError.badRequest('This is not archived.')
      // Restores to draft, never straight back to live — publishing stays a
      // deliberate, separate decision.
      return { status: 'DRAFT', archivedAt: null }

    default:
      throw ApiError.badRequest('Unknown action.')
  }
}

export const TRANSITIONS: Transition[] = [
  'publish',
  'unpublish',
  'submit',
  'request-changes',
  'archive',
  'restore',
]
