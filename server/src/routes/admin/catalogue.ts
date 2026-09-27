import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, asyncHandler } from '../../lib/errors.js'
import { CONTENT_STATUSES, VISUAL_VARIANTS } from '../../lib/constants.js'
import { pagination, paged, slugify, uniqueSlug, param } from '../../lib/util.js'
import { stringifyJson } from '../../lib/json.js'
import { requirePermission } from '../../auth/middleware.js'
import { recordAudit } from '../../services/audit.js'
import { snapshot, listVersions, getVersion } from '../../services/versions.js'
import { PRODUCT_INCLUDE, adminCategory, adminProduct } from '../../services/serialize.js'
import { TRANSITIONS, applyTransition, type Transition } from './lifecycle.js'

export const catalogueRouter = Router()

const specificationSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(400),
})

const productBody = z.object({
  categoryId: z.string().min(1, 'Choose a category.'),
  name: z.string().trim().min(2, 'Enter a product name.').max(160),
  seoName: z.string().trim().max(200).optional().or(z.literal('')),
  slug: z.string().trim().max(96).optional().or(z.literal('')),
  sku: z.string().trim().max(80).optional().or(z.literal('')),
  summary: z.string().trim().min(10, 'Write a short summary.').max(400),
  description: z.string().trim().min(20, 'Write a description.').max(8000),
  visual: z.enum(VISUAL_VARIANTS),
  mainImageId: z.string().nullable().optional(),
  ogImageId: z.string().nullable().optional(),
  // Optional by design: the business has not supplied figures for every
  // product, and an empty list renders "available on request".
  specifications: z.array(specificationSchema).max(40).default([]),
  useCases: z.array(z.string().trim().min(3).max(300)).max(20).default([]),
  applications: z.array(z.string()).max(20).default([]),
  requirementTags: z.array(z.string()).max(20).default([]),
  relatedProducts: z.array(z.string()).max(12).default([]),
  featured: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
  seoTitle: z.string().trim().max(200).optional().or(z.literal('')),
  seoDescription: z.string().trim().max(400).optional().or(z.literal('')),
})

/** Resolves application/requirement slugs (or ids) to join-table rows. */
async function resolveTaxonomy(applicationSlugs: string[], requirementSlugs: string[]) {
  const [applications, tags] = await Promise.all([
    prisma.application.findMany({
      where: { OR: [{ slug: { in: applicationSlugs } }, { id: { in: applicationSlugs } }] },
      select: { id: true },
    }),
    prisma.requirementTag.findMany({
      where: { OR: [{ slug: { in: requirementSlugs } }, { id: { in: requirementSlugs } }] },
      select: { id: true },
    }),
  ])
  return { applicationIds: applications.map((a) => a.id), tagIds: tags.map((t) => t.id) }
}

/* -------------------------------------------------------------- Products */

catalogueRouter.get(
  '/products',
  requirePermission('content:read'),
  asyncHandler(async (req, res) => {
    const params = pagination(req.query as Record<string, unknown>)
    const search = String(req.query.search ?? '').trim()
    const status = String(req.query.status ?? '').trim()
    const categoryId = String(req.query.categoryId ?? '').trim()

    const where = {
      ...(status && CONTENT_STATUSES.includes(status as never) ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
              { summary: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const sortable: Record<string, object> = {
      name: { name: 'asc' },
      updated: { updatedAt: 'desc' },
      order: { displayOrder: 'asc' },
      status: { status: 'asc' },
    }
    const orderBy = sortable[String(req.query.sort ?? 'updated')] ?? { updatedAt: 'desc' }

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.take,
        include: {
          ...PRODUCT_INCLUDE,
          category: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.product.count({ where }),
    ])

    res.json(
      paged(
        rows.map((row) => ({ ...adminProduct(row), categoryName: row.category.name })),
        total,
        params,
      ),
    )
  }),
)

catalogueRouter.get(
  '/products/:id',
  requirePermission('content:read'),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: param(req, 'id') },
      include: {
        ...PRODUCT_INCLUDE,
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    })
    if (!product) throw ApiError.notFound('Product not found.')
    res.json({ product: adminProduct(product) })
  }),
)

catalogueRouter.post(
  '/products',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const input = productBody.parse(req.body)

    const slug = await uniqueSlug(input.slug || input.name, async (candidate) =>
      Boolean(await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } })),
    )
    const { applicationIds, tagIds } = await resolveTaxonomy(
      input.applications,
      input.requirementTags,
    )

    const product = await prisma.product.create({
      data: {
        categoryId: input.categoryId,
        name: input.name,
        seoName: input.seoName || null,
        slug,
        sku: input.sku || null,
        summary: input.summary,
        description: input.description,
        visual: input.visual,
        mainImageId: input.mainImageId || null,
        ogImageId: input.ogImageId || null,
        specifications: stringifyJson(input.specifications),
        useCases: stringifyJson(input.useCases),
        featured: input.featured,
        displayOrder: input.displayOrder,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
        // New content always starts as a draft, never live.
        status: 'DRAFT',
        createdById: req.user!.id,
        updatedById: req.user!.id,
        applications: { create: applicationIds.map((id) => ({ applicationId: id })) },
        requirementTags: { create: tagIds.map((id) => ({ requirementTagId: id })) },
        relatedFrom: {
          create: input.relatedProducts.map((relatedId, index) => ({
            relatedId,
            displayOrder: index,
          })),
        },
      },
      include: PRODUCT_INCLUDE,
    })

    await recordAudit(req, {
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: product.id,
      summary: `Created product "${product.name}"`,
    })

    res.status(201).json({ product: adminProduct(product) })
  }),
)

catalogueRouter.put(
  '/products/:id',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const input = productBody.parse(req.body)
    const existing = await prisma.product.findUnique({
      where: { id: param(req, 'id') },
      include: PRODUCT_INCLUDE,
    })
    if (!existing) throw ApiError.notFound('Product not found.')

    let slug = existing.slug
    if (input.slug && slugify(input.slug) !== existing.slug) {
      slug = await uniqueSlug(input.slug, async (candidate) =>
        Boolean(
          await prisma.product.findFirst({
            where: { slug: candidate, NOT: { id: existing.id } },
            select: { id: true },
          }),
        ),
      )
    }

    const { applicationIds, tagIds } = await resolveTaxonomy(
      input.applications,
      input.requirementTags,
    )

    const product = await prisma.$transaction(async (tx) => {
      await tx.productApplication.deleteMany({ where: { productId: existing.id } })
      await tx.productRequirementTag.deleteMany({ where: { productId: existing.id } })
      await tx.relatedProduct.deleteMany({ where: { productId: existing.id } })

      return tx.product.update({
        where: { id: existing.id },
        data: {
          categoryId: input.categoryId,
          name: input.name,
          seoName: input.seoName || null,
          slug,
          sku: input.sku || null,
          summary: input.summary,
          description: input.description,
          visual: input.visual,
          mainImageId: input.mainImageId || null,
          ogImageId: input.ogImageId || null,
          specifications: stringifyJson(input.specifications),
          useCases: stringifyJson(input.useCases),
          featured: input.featured,
          displayOrder: input.displayOrder,
          seoTitle: input.seoTitle || null,
          seoDescription: input.seoDescription || null,
          updatedById: req.user!.id,
          applications: { create: applicationIds.map((id) => ({ applicationId: id })) },
          requirementTags: { create: tagIds.map((id) => ({ requirementTagId: id })) },
          relatedFrom: {
            create: input.relatedProducts
              .filter((id) => id !== existing.id)
              .map((relatedId, index) => ({ relatedId, displayOrder: index })),
          },
        },
        include: PRODUCT_INCLUDE,
      })
    })

    await recordAudit(req, {
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: product.id,
      summary: `Updated product "${product.name}"`,
      before: { name: existing.name, summary: existing.summary, status: existing.status },
      after: { name: product.name, summary: product.summary, status: product.status },
    })

    res.json({ product: adminProduct(product) })
  }),
)

/** Duplicate as a draft — the fastest way to add a near-identical product. */
catalogueRouter.post(
  '/products/:id/duplicate',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const source = await prisma.product.findUnique({
      where: { id: param(req, 'id') },
      include: PRODUCT_INCLUDE,
    })
    if (!source) throw ApiError.notFound('Product not found.')

    const slug = await uniqueSlug(`${source.slug}-copy`, async (candidate) =>
      Boolean(await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } })),
    )

    const copy = await prisma.product.create({
      data: {
        categoryId: source.categoryId,
        name: `${source.name} (copy)`,
        seoName: source.seoName,
        slug,
        summary: source.summary,
        description: source.description,
        visual: source.visual,
        mainImageId: source.mainImageId,
        specifications: source.specifications,
        useCases: source.useCases,
        displayOrder: source.displayOrder,
        status: 'DRAFT',
        createdById: req.user!.id,
        updatedById: req.user!.id,
        applications: {
          create: source.applications.map((row) => ({ applicationId: row.applicationId })),
        },
        requirementTags: {
          create: source.requirementTags.map((row) => ({ requirementTagId: row.requirementTagId })),
        },
      },
      include: PRODUCT_INCLUDE,
    })

    await recordAudit(req, {
      action: 'PRODUCT_DUPLICATED',
      entityType: 'Product',
      entityId: copy.id,
      summary: `Duplicated "${source.name}" as a draft`,
    })

    res.status(201).json({ product: adminProduct(copy) })
  }),
)

catalogueRouter.post(
  '/products/:id/:action',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const action = param(req, 'action') as Transition
    if (!TRANSITIONS.includes(action)) throw ApiError.notFound('Unknown action.')

    const existing = await prisma.product.findUnique({
      where: { id: param(req, 'id') },
      include: PRODUCT_INCLUDE,
    })
    if (!existing) throw ApiError.notFound('Product not found.')

    const next = applyTransition(req, existing.status, action)

    // Snapshot the state that is going live (or being taken down) so it can
    // be compared and restored later.
    if (action === 'publish' || action === 'archive') {
      await snapshot('Product', existing.id, adminProduct(existing), req.user!.id, `Before ${action}`)
    }

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: { ...next, updatedById: req.user!.id },
      include: PRODUCT_INCLUDE,
    })

    await recordAudit(req, {
      action: `PRODUCT_${action.toUpperCase().replace('-', '_')}`,
      entityType: 'Product',
      entityId: product.id,
      summary: `${action} product "${product.name}"`,
      before: { status: existing.status },
      after: { status: product.status },
      reason: typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null,
    })

    res.json({ product: adminProduct(product) })
  }),
)

/**
 * Hard delete is intentionally restrictive. Archiving is the normal route;
 * deleting is refused outright while anything still references the product,
 * so history and enquiries cannot be silently orphaned.
 */
catalogueRouter.delete(
  '/products/:id',
  requirePermission('content:publish'),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: param(req, 'id') },
      include: {
        _count: { select: { reviews: true, projectLinks: true, enquiryItems: true } },
      },
    })
    if (!product) throw ApiError.notFound('Product not found.')

    const { reviews, projectLinks, enquiryItems } = product._count
    if (reviews + projectLinks + enquiryItems > 0) {
      throw ApiError.conflict(
        'This product is still referenced, so it cannot be deleted. Archive it instead — it will disappear from the website but the history stays intact.',
        { reviews, projects: projectLinks, enquiries: enquiryItems },
      )
    }

    await prisma.product.delete({ where: { id: product.id } })
    await recordAudit(req, {
      action: 'PRODUCT_DELETED',
      entityType: 'Product',
      entityId: product.id,
      summary: `Permanently deleted product "${product.name}"`,
    })

    res.json({ ok: true })
  }),
)

/** What a delete would affect — shown in the confirmation dialog. */
catalogueRouter.get(
  '/products/:id/impact',
  requirePermission('content:read'),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: param(req, 'id') },
      include: { _count: { select: { reviews: true, projectLinks: true, enquiryItems: true } } },
    })
    if (!product) throw ApiError.notFound('Product not found.')
    res.json({
      reviews: product._count.reviews,
      projects: product._count.projectLinks,
      enquiries: product._count.enquiryItems,
      canDelete:
        product._count.reviews + product._count.projectLinks + product._count.enquiryItems === 0,
    })
  }),
)

catalogueRouter.get(
  '/products/:id/versions',
  requirePermission('content:read'),
  asyncHandler(async (req, res) => {
    res.json({ versions: await listVersions('Product', param(req, 'id')) })
  }),
)

catalogueRouter.get(
  '/products/:id/versions/:version',
  requirePermission('content:read'),
  asyncHandler(async (req, res) => {
    const version = await getVersion('Product', param(req, 'id'), Number(param(req, 'version')))
    if (!version) throw ApiError.notFound('Version not found.')
    res.json({ version })
  }),
)

/* ------------------------------------------------------------ Categories */

const categoryBody = z.object({
  divisionId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  shortName: z.string().trim().max(40).optional().or(z.literal('')),
  slug: z.string().trim().max(96).optional().or(z.literal('')),
  summary: z.string().trim().min(10).max(400),
  description: z.string().trim().min(20).max(6000),
  visual: z.enum(VISUAL_VARIANTS),
  imageId: z.string().nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
  seoTitle: z.string().trim().max(200).optional().or(z.literal('')),
  seoDescription: z.string().trim().max(400).optional().or(z.literal('')),
})

catalogueRouter.get(
  '/categories',
  requirePermission('content:read'),
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { _count: { select: { products: true } }, division: true },
    })
    res.json({
      categories: categories.map((category) => ({
        ...adminCategory(category),
        divisionName: category.division.name,
      })),
    })
  }),
)

catalogueRouter.post(
  '/categories',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const input = categoryBody.parse(req.body)
    const slug = await uniqueSlug(input.slug || input.name, async (candidate) =>
      Boolean(
        await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } }),
      ),
    )
    const category = await prisma.category.create({
      data: {
        divisionId: input.divisionId,
        name: input.name,
        shortName: input.shortName || null,
        slug,
        summary: input.summary,
        description: input.description,
        visual: input.visual,
        imageId: input.imageId || null,
        displayOrder: input.displayOrder,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
        status: 'DRAFT',
      },
    })
    await recordAudit(req, {
      action: 'CATEGORY_CREATED',
      entityType: 'Category',
      entityId: category.id,
      summary: `Created category "${category.name}"`,
    })
    res.status(201).json({ category: adminCategory(category) })
  }),
)

catalogueRouter.put(
  '/categories/:id',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const input = categoryBody.parse(req.body)
    const existing = await prisma.category.findUnique({ where: { id: param(req, 'id') } })
    if (!existing) throw ApiError.notFound('Category not found.')

    let slug = existing.slug
    if (input.slug && slugify(input.slug) !== existing.slug) {
      slug = await uniqueSlug(input.slug, async (candidate) =>
        Boolean(
          await prisma.category.findFirst({
            where: { slug: candidate, NOT: { id: existing.id } },
            select: { id: true },
          }),
        ),
      )
    }

    const category = await prisma.category.update({
      where: { id: existing.id },
      data: {
        divisionId: input.divisionId,
        name: input.name,
        shortName: input.shortName || null,
        slug,
        summary: input.summary,
        description: input.description,
        visual: input.visual,
        imageId: input.imageId || null,
        displayOrder: input.displayOrder,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
      },
    })
    await recordAudit(req, {
      action: 'CATEGORY_UPDATED',
      entityType: 'Category',
      entityId: category.id,
      summary: `Updated category "${category.name}"`,
      before: { name: existing.name, slug: existing.slug },
      after: { name: category.name, slug: category.slug },
    })
    res.json({ category: adminCategory(category) })
  }),
)

catalogueRouter.post(
  '/categories/:id/:action',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const action = param(req, 'action') as Transition
    if (!TRANSITIONS.includes(action)) throw ApiError.notFound('Unknown action.')

    const existing = await prisma.category.findUnique({
      where: { id: param(req, 'id') },
      include: { _count: { select: { products: true } } },
    })
    if (!existing) throw ApiError.notFound('Category not found.')

    // Taking a family offline hides its products too, so make that explicit
    // rather than letting it surprise the admin afterwards.
    if ((action === 'unpublish' || action === 'archive') && existing._count.products > 0) {
      const publishedProducts = await prisma.product.count({
        where: { categoryId: existing.id, status: 'PUBLISHED' },
      })
      if (publishedProducts > 0 && req.query.confirm !== 'true') {
        throw ApiError.conflict(
          `${publishedProducts} published product${publishedProducts === 1 ? '' : 's'} sit inside this family and will disappear from the website. Confirm to continue.`,
          { publishedProducts, requiresConfirmation: true },
        )
      }
    }

    const next = applyTransition(req, existing.status, action)
    const category = await prisma.category.update({ where: { id: existing.id }, data: next })

    await recordAudit(req, {
      action: `CATEGORY_${action.toUpperCase().replace('-', '_')}`,
      entityType: 'Category',
      entityId: category.id,
      summary: `${action} category "${category.name}"`,
      before: { status: existing.status },
      after: { status: category.status },
    })
    res.json({ category: adminCategory(category) })
  }),
)

/* -------------------------------------------------------------- Taxonomy */

catalogueRouter.get(
  '/taxonomy',
  requirePermission('content:read'),
  asyncHandler(async (_req, res) => {
    const [applications, requirementTags, divisions] = await Promise.all([
      prisma.application.findMany({ orderBy: { displayOrder: 'asc' } }),
      prisma.requirementTag.findMany({ orderBy: { displayOrder: 'asc' } }),
      prisma.division.findMany({ orderBy: { displayOrder: 'asc' } }),
    ])
    res.json({ applications, requirementTags, divisions })
  }),
)
