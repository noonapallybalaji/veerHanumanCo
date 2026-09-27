import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, asyncHandler } from '../../lib/errors.js'
import { ENQUIRY_STATUSES } from '../../lib/constants.js'
import { pagination, paged, param } from '../../lib/util.js'
import { requirePermission } from '../../auth/middleware.js'
import { recordAudit } from '../../services/audit.js'

export const enquiriesRouter = Router()

/**
 * Lead management.
 *
 * Enquiries contain customer contact details, so every route here sits
 * behind `enquiry:read` and nothing in this file is reachable publicly.
 */

const ENQUIRY_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true, slug: true } } } },
  adminNotes: {
    orderBy: { createdAt: 'desc' as const },
    include: { author: { select: { id: true, name: true } } },
  },
}

enquiriesRouter.get(
  '/',
  requirePermission('enquiry:read'),
  asyncHandler(async (req, res) => {
    const params = pagination(req.query as Record<string, unknown>)
    const status = String(req.query.status ?? '').trim()
    const search = String(req.query.search ?? '').trim()

    const where = {
      ...(status && ENQUIRY_STATUSES.includes(status as never) ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { company: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { deliveryLocation: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [rows, total, counts] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: ENQUIRY_INCLUDE,
      }),
      prisma.enquiry.count({ where }),
      prisma.enquiry.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    res.json({
      ...paged(rows, total, params),
      statusCounts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    })
  }),
)

enquiriesRouter.get(
  '/export.csv',
  requirePermission('enquiry:read'),
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? '').trim()
    const rows = await prisma.enquiry.findMany({
      where: status && ENQUIRY_STATUSES.includes(status as never) ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { items: true },
      take: 5000,
    })

    const header = [
      'Reference',
      'Received',
      'Status',
      'Name',
      'Company',
      'Phone',
      'Email',
      'Project type',
      'Delivery location',
      'Required by',
      'Products',
      'Notes',
    ]

    const lines = rows.map((row) =>
      [
        row.id.slice(-8).toUpperCase(),
        row.createdAt.toISOString(),
        row.status,
        row.name,
        row.company ?? '',
        row.phone,
        row.email ?? '',
        row.projectType ?? '',
        row.deliveryLocation ?? '',
        row.requirementDate ?? '',
        row.items
          .map((item) =>
            [item.productName, item.quantity, item.specification].filter(Boolean).join(' / '),
          )
          .join(' | '),
        row.notes ?? '',
      ].map(csvCell).join(','),
    )

    await recordAudit(req, {
      action: 'ENQUIRIES_EXPORTED',
      entityType: 'Enquiry',
      summary: `Exported ${rows.length} enquiries to CSV`,
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="enquiries.csv"')
    res.send([header.join(','), ...lines].join('\r\n'))
  }),
)

enquiriesRouter.get(
  '/:id',
  requirePermission('enquiry:read'),
  asyncHandler(async (req, res) => {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: param(req, 'id') },
      include: ENQUIRY_INCLUDE,
    })
    if (!enquiry) throw ApiError.notFound('Enquiry not found.')
    res.json({ enquiry })
  }),
)

enquiriesRouter.put(
  '/:id/status',
  requirePermission('enquiry:write'),
  asyncHandler(async (req, res) => {
    const schema = z.object({ status: z.enum(ENQUIRY_STATUSES) })
    const input = schema.parse(req.body)

    const existing = await prisma.enquiry.findUnique({ where: { id: param(req, 'id') } })
    if (!existing) throw ApiError.notFound('Enquiry not found.')

    const enquiry = await prisma.enquiry.update({
      where: { id: existing.id },
      data: { status: input.status },
      include: ENQUIRY_INCLUDE,
    })

    await recordAudit(req, {
      action: 'ENQUIRY_STATUS_CHANGED',
      entityType: 'Enquiry',
      entityId: enquiry.id,
      // Deliberately no customer details in the audit summary.
      summary: `Enquiry ${enquiry.id.slice(-8).toUpperCase()} moved to ${input.status}`,
      before: { status: existing.status },
      after: { status: enquiry.status },
    })

    res.json({ enquiry })
  }),
)

enquiriesRouter.post(
  '/:id/notes',
  requirePermission('enquiry:write'),
  asyncHandler(async (req, res) => {
    const schema = z.object({ body: z.string().trim().min(1, 'Write a note.').max(2000) })
    const input = schema.parse(req.body)

    const enquiry = await prisma.enquiry.findUnique({ where: { id: param(req, 'id') } })
    if (!enquiry) throw ApiError.notFound('Enquiry not found.')

    const note = await prisma.enquiryNote.create({
      data: { enquiryId: enquiry.id, authorId: req.user!.id, body: input.body },
      include: { author: { select: { id: true, name: true } } },
    })

    res.status(201).json({ note })
  }),
)

/** Minimal CSV escaping — quotes doubled, field wrapped when needed. */
function csvCell(value: string): string {
  const text = String(value ?? '')
  // A leading =, +, - or @ makes spreadsheet software treat the cell as a
  // formula, so prefix those to neutralise CSV injection.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
