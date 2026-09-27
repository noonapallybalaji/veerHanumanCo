import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, asyncHandler } from '../../lib/errors.js'
import { CONTENT_STATUSES, VISUAL_VARIANTS } from '../../lib/constants.js'
import { pagination, paged, slugify, uniqueSlug, param } from '../../lib/util.js'
import { requirePermission } from '../../auth/middleware.js'
import { recordAudit } from '../../services/audit.js'
import { snapshot } from '../../services/versions.js'
import { adminProject } from '../../services/serialize.js'
import { TRANSITIONS, applyTransition, type Transition } from './lifecycle.js'

export const projectsRouter = Router()

const PROJECT_INCLUDE = {
  images: { orderBy: { displayOrder: 'asc' as const } },
  products: true,
  updatedBy: { select: { id: true, name: true } },
}

const projectBody = z
  .object({
    title: z.string().trim().min(3, 'Enter a project title.').max(200),
    slug: z.string().trim().max(96).optional().or(z.literal('')),
    summary: z.string().trim().min(10, 'Write a short summary.').max(400),
    description: z.string().trim().min(20, 'Describe the project.').max(8000),
    projectType: z.string().trim().max(80).optional().or(z.literal('')),
    location: z.string().trim().max(160).optional().or(z.literal('')),
    clientName: z.string().trim().max(160).optional().or(z.literal('')),
    clientPublishable: z.boolean().default(false),
    completedYear: z.coerce
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 1)
      .nullable()
      .optional(),
    scope: z.string().trim().max(2000).optional().or(z.literal('')),
    quantitySupplied: z.string().trim().max(200).optional().or(z.literal('')),
    testimonialQuote: z.string().trim().max(1200).optional().or(z.literal('')),
    testimonialAuthor: z.string().trim().max(160).optional().or(z.literal('')),
    testimonialConsent: z.boolean().default(false),
    coverImageId: z.string().nullable().optional(),
    visual: z.enum(VISUAL_VARIANTS).default('infrastructure'),
    productIds: z.array(z.string()).max(40).default([]),
    featured: z.boolean().default(false),
    displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
    seoTitle: z.string().trim().max(200).optional().or(z.literal('')),
    seoDescription: z.string().trim().max(400).optional().or(z.literal('')),
  })
  // Consent is enforced at the schema level, not just in the UI: a client
  // name or testimonial cannot be marked publishable without it.
  .refine((data) => !data.clientPublishable || Boolean(data.clientName?.trim()), {
    message: 'Enter the client name, or turn off publishing the client name.',
    path: ['clientName'],
  })
  .refine((data) => !data.testimonialQuote?.trim() || data.testimonialConsent, {
    message:
      'A testimonial can only be stored for publishing once you confirm the client has agreed to it.',
    path: ['testimonialConsent'],
  })

projectsRouter.get(
  '/',
  requirePermission('content:read'),
  asyncHandler(async (req, res) => {
    const params = pagination(req.query as Record<string, unknown>)
    const search = String(req.query.search ?? '').trim()
    const status = String(req.query.status ?? '').trim()
    const productId = String(req.query.productId ?? '').trim()

    const where = {
      ...(status && CONTENT_STATUSES.includes(status as never) ? { status } : {}),
      ...(productId ? { products: { some: { productId } } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { summary: { contains: search, mode: 'insensitive' as const } },
              { location: { contains: search, mode: 'insensitive' as const } },
              { projectType: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: PROJECT_INCLUDE,
      }),
      prisma.project.count({ where }),
    ])

    res.json(paged(rows.map(adminProject), total, params))
  }),
)

projectsRouter.get(
  '/:id',
  requirePermission('content:read'),
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: param(req, 'id') },
      include: PROJECT_INCLUDE,
    })
    if (!project) throw ApiError.notFound('Project not found.')
    res.json({ project: adminProject(project) })
  }),
)

projectsRouter.post(
  '/',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const input = projectBody.parse(req.body)
    const slug = await uniqueSlug(input.slug || input.title, async (candidate) =>
      Boolean(await prisma.project.findUnique({ where: { slug: candidate }, select: { id: true } })),
    )

    const project = await prisma.project.create({
      data: {
        ...toProjectData(input),
        slug,
        status: 'DRAFT',
        createdById: req.user!.id,
        updatedById: req.user!.id,
        products: { create: input.productIds.map((productId) => ({ productId })) },
      },
      include: PROJECT_INCLUDE,
    })

    await recordAudit(req, {
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: project.id,
      summary: `Created project "${project.title}"`,
    })
    res.status(201).json({ project: adminProject(project) })
  }),
)

projectsRouter.put(
  '/:id',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const input = projectBody.parse(req.body)
    const existing = await prisma.project.findUnique({ where: { id: param(req, 'id') } })
    if (!existing) throw ApiError.notFound('Project not found.')

    let slug = existing.slug
    if (input.slug && slugify(input.slug) !== existing.slug) {
      slug = await uniqueSlug(input.slug, async (candidate) =>
        Boolean(
          await prisma.project.findFirst({
            where: { slug: candidate, NOT: { id: existing.id } },
            select: { id: true },
          }),
        ),
      )
    }

    const project = await prisma.$transaction(async (tx) => {
      await tx.projectProduct.deleteMany({ where: { projectId: existing.id } })
      return tx.project.update({
        where: { id: existing.id },
        data: {
          ...toProjectData(input),
          slug,
          updatedById: req.user!.id,
          products: { create: input.productIds.map((productId) => ({ productId })) },
        },
        include: PROJECT_INCLUDE,
      })
    })

    await recordAudit(req, {
      action: 'PROJECT_UPDATED',
      entityType: 'Project',
      entityId: project.id,
      summary: `Updated project "${project.title}"`,
      before: { title: existing.title, status: existing.status },
      after: { title: project.title, status: project.status },
    })
    res.json({ project: adminProject(project) })
  }),
)

projectsRouter.post(
  '/:id/:action',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const action = param(req, 'action') as Transition
    if (!TRANSITIONS.includes(action)) throw ApiError.notFound('Unknown action.')

    const existing = await prisma.project.findUnique({
      where: { id: param(req, 'id') },
      include: PROJECT_INCLUDE,
    })
    if (!existing) throw ApiError.notFound('Project not found.')

    if (action === 'publish' || action === 'archive') {
      await snapshot('Project', existing.id, adminProject(existing), req.user!.id, `Before ${action}`)
    }

    const next = applyTransition(req, existing.status, action)
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: { ...next, updatedById: req.user!.id },
      include: PROJECT_INCLUDE,
    })

    await recordAudit(req, {
      action: `PROJECT_${action.toUpperCase().replace('-', '_')}`,
      entityType: 'Project',
      entityId: project.id,
      summary: `${action} project "${project.title}"`,
      before: { status: existing.status },
      after: { status: project.status },
    })
    res.json({ project: adminProject(project) })
  }),
)

projectsRouter.delete(
  '/:id',
  requirePermission('content:publish'),
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({ where: { id: param(req, 'id') } })
    if (!project) throw ApiError.notFound('Project not found.')

    await prisma.project.delete({ where: { id: project.id } })
    await recordAudit(req, {
      action: 'PROJECT_DELETED',
      entityType: 'Project',
      entityId: project.id,
      summary: `Permanently deleted project "${project.title}"`,
    })
    res.json({ ok: true })
  }),
)

/* --------------------------------------------------------- Project images */

projectsRouter.post(
  '/:id/images',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      mediaId: z.string().min(1),
      alt: z.string().trim().min(1, 'Describe the image for screen readers.').max(200),
      caption: z.string().trim().max(300).optional().or(z.literal('')),
    })
    const input = schema.parse(req.body)

    const last = await prisma.projectImage.findFirst({
      where: { projectId: param(req, 'id') },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    })

    const image = await prisma.projectImage.create({
      data: {
        projectId: param(req, 'id'),
        mediaId: input.mediaId,
        alt: input.alt,
        caption: input.caption || null,
        displayOrder: (last?.displayOrder ?? -1) + 1,
      },
    })
    res.status(201).json({ image })
  }),
)

projectsRouter.delete(
  '/:id/images/:imageId',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    await prisma.projectImage.deleteMany({
      where: { id: param(req, 'imageId'), projectId: param(req, 'id') },
    })
    res.json({ ok: true })
  }),
)

projectsRouter.post(
  '/:id/images/reorder',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const schema = z.object({ order: z.array(z.string()).max(60) })
    const { order } = schema.parse(req.body)
    await prisma.$transaction(
      order.map((imageId, index) =>
        prisma.projectImage.updateMany({
          where: { id: imageId, projectId: param(req, 'id') },
          data: { displayOrder: index },
        }),
      ),
    )
    res.json({ ok: true })
  }),
)

type ProjectInput = z.infer<typeof projectBody>

function toProjectData(input: ProjectInput) {
  return {
    title: input.title,
    summary: input.summary,
    description: input.description,
    projectType: input.projectType || null,
    location: input.location || null,
    clientName: input.clientName || null,
    clientPublishable: input.clientPublishable,
    completedYear: input.completedYear ?? null,
    scope: input.scope || null,
    quantitySupplied: input.quantitySupplied || null,
    testimonialQuote: input.testimonialQuote || null,
    testimonialAuthor: input.testimonialAuthor || null,
    testimonialConsent: input.testimonialConsent,
    coverImageId: input.coverImageId || null,
    visual: input.visual,
    featured: input.featured,
    displayOrder: input.displayOrder,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
  }
}
