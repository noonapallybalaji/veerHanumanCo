import { Router } from 'express'
import { prisma } from '../../db.js'
import { asyncHandler } from '../../lib/errors.js'
import { pagination, paged } from '../../lib/util.js'
import { requirePermission } from '../../auth/middleware.js'

export const leadsRouter = Router()

/**
 * Welcome-modal leads.
 *
 * Sits behind `enquiry:read` because a lead is customer contact data, and
 * shows verification status prominently: an unverified lead is a number
 * nobody has proved, which changes how much the sales team should trust it.
 */
leadsRouter.get(
  '/',
  requirePermission('enquiry:read'),
  asyncHandler(async (req, res) => {
    const params = pagination(req.query as Record<string, unknown>)
    const search = String(req.query.search ?? '').trim()
    const verified = String(req.query.verified ?? '').trim()
    const source = String(req.query.source ?? '').trim()

    const where = {
      ...(verified === 'true' ? { isPhoneVerified: true } : {}),
      ...(verified === 'false' ? { isPhoneVerified: false } : {}),
      ...(source ? { source } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
              { company: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { requirement: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [rows, total, counts, sources] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          customer: { select: { id: true, phone: true, phoneVerifiedAt: true } },
        },
      }),
      prisma.lead.count({ where }),
      prisma.lead.groupBy({ by: ['isPhoneVerified'], _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['source'], _count: { _all: true } }),
    ])

    res.json({
      ...paged(
        rows.map((lead) => ({
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          company: lead.company,
          email: lead.email,
          requirement: lead.requirement,
          source: lead.source,
          isPhoneVerified: lead.isPhoneVerified,
          marketingConsent: lead.marketingConsent,
          consentAccepted: lead.consentAccepted,
          hasAccount: Boolean(lead.customerId),
          createdAt: lead.createdAt,
          // Never exposed: ipHash.
        })),
        total,
        params,
      ),
      verifiedCounts: {
        verified: counts.find((row) => row.isPhoneVerified)?._count._all ?? 0,
        unverified: counts.find((row) => !row.isPhoneVerified)?._count._all ?? 0,
      },
      sources: sources.map((row) => ({ source: row.source, count: row._count._all })),
    })
  }),
)
