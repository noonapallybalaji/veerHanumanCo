import { Router } from 'express'
import { prisma } from '../../db.js'
import { asyncHandler } from '../../lib/errors.js'
import { requirePermission } from '../../auth/middleware.js'

export const dashboardRouter = Router()

/**
 * Overview counts.
 *
 * Every number here is a real database query. There is deliberately no
 * sample or illustrative data: a dashboard that invents activity is worse
 * than an empty one, because the owner cannot tell which figures to trust.
 */
dashboardRouter.get(
  '/',
  requirePermission('content:read'),
  asyncHandler(async (_req, res) => {
    const [
      publishedProducts,
      draftProducts,
      inReviewProducts,
      archivedProducts,
      publishedProjects,
      draftProjects,
      pendingReviews,
      reportedReviews,
      publishedReviews,
      newEnquiries,
      totalEnquiries,
      recentActivity,
      recentContent,
    ] = await Promise.all([
      prisma.product.count({ where: { status: 'PUBLISHED' } }),
      prisma.product.count({ where: { status: 'DRAFT' } }),
      prisma.product.count({ where: { status: 'IN_REVIEW' } }),
      prisma.product.count({ where: { status: 'ARCHIVED' } }),
      prisma.project.count({ where: { status: 'PUBLISHED' } }),
      prisma.project.count({ where: { status: { in: ['DRAFT', 'IN_REVIEW'] } } }),
      prisma.review.count({ where: { status: 'PENDING' } }),
      prisma.reviewReport.count({ where: { status: 'OPEN' } }),
      prisma.review.count({ where: { status: 'APPROVED' } }),
      prisma.enquiry.count({ where: { status: 'NEW' } }),
      prisma.enquiry.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { actor: { select: { name: true } } },
      }),
      prisma.product.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, name: true, slug: true, status: true, updatedAt: true },
      }),
    ])

    res.json({
      products: {
        published: publishedProducts,
        draft: draftProducts,
        inReview: inReviewProducts,
        archived: archivedProducts,
      },
      projects: { published: publishedProjects, draft: draftProjects },
      reviews: { pending: pendingReviews, reported: reportedReviews, published: publishedReviews },
      enquiries: { new: newEnquiries, total: totalEnquiries },
      recentActivity: recentActivity.map((entry) => ({
        id: entry.id,
        action: entry.action,
        summary: entry.summary,
        actor: entry.actor?.name ?? entry.actorEmail ?? 'System',
        at: entry.createdAt,
      })),
      recentContent,
    })
  }),
)
