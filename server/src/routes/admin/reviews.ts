import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, asyncHandler } from '../../lib/errors.js'
import { REVIEW_STATUSES } from '../../lib/constants.js'
import { pagination, paged, param } from '../../lib/util.js'
import { requirePermission } from '../../auth/middleware.js'
import { recordAudit } from '../../services/audit.js'
import { adminReview } from '../../services/serialize.js'

export const reviewsRouter = Router()

/**
 * Review moderation.
 *
 * Two principles are enforced here rather than left to the UI:
 *  - A moderator can change a review's *visibility* and attach an internal
 *    reason, but cannot rewrite the customer's words. There is no endpoint
 *    that edits `body`, `rating` or `displayName`.
 *  - Every state change writes a ReviewEvent, so the moderation history is
 *    reconstructable and attributable.
 */

const REVIEW_INCLUDE = {
  product: { select: { id: true, name: true, slug: true } },
  events: {
    orderBy: { createdAt: 'desc' as const },
    include: { actor: { select: { id: true, name: true } } },
  },
  _count: { select: { reports: true } },
}

reviewsRouter.get(
  '/',
  requirePermission('review:read'),
  asyncHandler(async (req, res) => {
    const params = pagination(req.query as Record<string, unknown>)
    const status = String(req.query.status ?? '').trim()
    const productId = String(req.query.productId ?? '').trim()
    const rating = Number.parseInt(String(req.query.rating ?? ''), 10)
    const search = String(req.query.search ?? '').trim()

    const where = {
      ...(status && REVIEW_STATUSES.includes(status as never) ? { status } : {}),
      ...(productId ? { productId } : {}),
      ...(Number.isInteger(rating) && rating >= 1 && rating <= 5 ? { rating } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' as const } },
              { body: { contains: search, mode: 'insensitive' as const } },
              { title: { contains: search, mode: 'insensitive' as const } },
              { companyName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [rows, total, counts] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: REVIEW_INCLUDE,
      }),
      prisma.review.count({ where }),
      prisma.review.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    res.json({
      ...paged(rows.map(adminReview), total, params),
      statusCounts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    })
  }),
)

reviewsRouter.get(
  '/:id',
  requirePermission('review:read'),
  asyncHandler(async (req, res) => {
    const review = await prisma.review.findUnique({
      where: { id: param(req, 'id') },
      include: { ...REVIEW_INCLUDE, reports: { orderBy: { createdAt: 'desc' } } },
    })
    if (!review) throw ApiError.notFound('Review not found.')
    res.json({ review: adminReview(review), reports: review.reports })
  }),
)

const MODERATION = {
  approve: { status: 'APPROVED', action: 'APPROVED', requiresReason: false },
  reject: { status: 'REJECTED', action: 'REJECTED', requiresReason: true },
  hide: { status: 'HIDDEN', action: 'HIDDEN', requiresReason: true },
  restore: { status: 'APPROVED', action: 'RESTORED', requiresReason: false },
  pending: { status: 'PENDING', action: 'EDITED', requiresReason: false },
} as const

type ModerationAction = keyof typeof MODERATION

reviewsRouter.post(
  '/:id/:action',
  requirePermission('review:moderate'),
  asyncHandler(async (req, res) => {
    const action = param(req, 'action') as ModerationAction
    const rule = MODERATION[action]
    if (!rule) throw ApiError.notFound('Unknown moderation action.')

    const schema = z.object({ reason: z.string().trim().max(1000).optional().or(z.literal('')) })
    const { reason } = schema.parse(req.body ?? {})

    // Rejecting or hiding a customer's words requires a recorded reason, so
    // the decision is always accountable.
    if (rule.requiresReason && !reason?.trim()) {
      throw ApiError.badRequest('Please record a reason for this decision.')
    }

    const existing = await prisma.review.findUnique({ where: { id: param(req, 'id') } })
    if (!existing) throw ApiError.notFound('Review not found.')

    const review = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: existing.id },
        data: {
          status: rule.status,
          internalReason: reason?.trim() || existing.internalReason,
          publishedAt: rule.status === 'APPROVED' ? (existing.publishedAt ?? new Date()) : null,
        },
      })
      await tx.reviewEvent.create({
        data: {
          reviewId: existing.id,
          action: rule.action,
          actorId: req.user!.id,
          reason: reason?.trim() || null,
        },
      })
      return updated
    })

    await recordAudit(req, {
      action: `REVIEW_${rule.action}`,
      entityType: 'Review',
      entityId: review.id,
      summary: `${action} review by "${existing.displayName}"`,
      before: { status: existing.status },
      after: { status: review.status },
      reason: reason?.trim() || null,
    })

    const full = await prisma.review.findUnique({
      where: { id: review.id },
      include: REVIEW_INCLUDE,
    })
    res.json({ review: adminReview(full) })
  }),
)

/* --------------------------------------------------------------- Reports */

reviewsRouter.get(
  '/reports/open',
  requirePermission('review:moderate'),
  asyncHandler(async (_req, res) => {
    const reports = await prisma.reviewReport.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: { review: { include: { product: { select: { name: true, slug: true } } } } },
      take: 100,
    })
    res.json({
      reports: reports.map((report) => ({
        id: report.id,
        reason: report.reason,
        note: report.reporterNote,
        createdAt: report.createdAt,
        review: {
          id: report.review.id,
          displayName: report.review.displayName,
          rating: report.review.rating,
          body: report.review.body,
          status: report.review.status,
          productName: report.review.product.name,
        },
      })),
    })
  }),
)

reviewsRouter.post(
  '/reports/:id/resolve',
  requirePermission('review:moderate'),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      outcome: z.enum(['RESOLVED', 'DISMISSED']),
      note: z.string().trim().max(500).optional().or(z.literal('')),
    })
    const input = schema.parse(req.body)

    const report = await prisma.reviewReport.findUnique({ where: { id: param(req, 'id') } })
    if (!report) throw ApiError.notFound('Report not found.')

    await prisma.reviewReport.update({
      where: { id: report.id },
      data: { status: input.outcome, resolvedAt: new Date(), resolvedById: req.user!.id },
    })

    await recordAudit(req, {
      action: 'REVIEW_REPORT_RESOLVED',
      entityType: 'ReviewReport',
      entityId: report.id,
      summary: `Marked report ${input.outcome.toLowerCase()}`,
      reason: input.note || null,
    })

    res.json({ ok: true })
  }),
)
