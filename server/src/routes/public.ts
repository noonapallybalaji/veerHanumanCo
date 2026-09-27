import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { ApiError, asyncHandler } from '../lib/errors.js'
import { PUBLIC_REVIEW_STATUS, PUBLIC_STATUS } from '../lib/constants.js'
import { hashIp, pagination, paged, param } from '../lib/util.js'
import { limitOf } from '../lib/rateLimit.js'
import { requireCustomerCsrf, requireVerifiedCustomer } from '../auth/customer.js'
import { normalisePhone } from '../auth/otp.js'
import {
  PRODUCT_INCLUDE,
  publicCategory,
  publicCompany,
  publicPage,
  publicProduct,
  publicProject,
  publicReview,
  publicService,
} from '../services/serialize.js'

/**
 * Public, read-mostly API.
 *
 * Two rules hold everywhere in this file:
 *  1. Every content query filters on status = PUBLISHED. There is no code
 *     path here that can return a draft or archived record.
 *  2. The only writes an anonymous caller can perform are submitting a
 *     review (which lands in the moderation queue), reporting a review, and
 *     submitting an enquiry. All three are rate limited.
 */

export const publicRouter = Router()

const published = { status: PUBLIC_STATUS }

/* ----------------------------------------------------------- Rate limits */

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: limitOf(5),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'You have submitted several reviews recently. Please try again later.',
    },
  },
})

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: limitOf(10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many enquiries from this connection. Please try again shortly.',
    },
  },
})

const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: limitOf(10), legacyHeaders: false })

/* --------------------------------------------------------- Content bundle */

/**
 * The whole published site in one response.
 *
 * The catalogue is small (single-digit product families), so one request at
 * boot is faster than a dozen round trips and lets the client keep using
 * synchronous selectors. Revisit this if the catalogue grows by an order of
 * magnitude.
 */
publicRouter.get(
  '/content',
  asyncHandler(async (_req, res) => {
    const [divisions, categories, products, services, applications, requirementTags, profile, pages, projects, offerings] =
      await Promise.all([
        prisma.division.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } }),
        prisma.category.findMany({ where: published, orderBy: { displayOrder: 'asc' } }),
        prisma.product.findMany({
          where: published,
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
          include: PRODUCT_INCLUDE,
        }),
        prisma.service.findMany({
          where: published,
          orderBy: { displayOrder: 'asc' },
          include: {
            applications: { include: { application: true } },
            requirementTags: { include: { requirementTag: true } },
          },
        }),
        prisma.application.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } }),
        prisma.requirementTag.findMany({
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        }),
        prisma.companyProfile.findUnique({ where: { id: 'singleton' } }),
        prisma.contentPage.findMany({
          where: published,
          include: { sections: true },
        }),
        prisma.project.findMany({
          where: published,
          orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }, { completedYear: 'desc' }],
          include: { images: { orderBy: { displayOrder: 'asc' } }, products: true },
        }),
        // Only owner-confirmed offerings are ever exposed.
        prisma.additionalOffering.findMany({
          where: { status: 'CONFIRMED' },
          orderBy: { displayOrder: 'asc' },
        }),
      ])

    // Published ratings only — pending, rejected and hidden reviews must not
    // influence any number a visitor sees.
    const ratingRows = await prisma.review.groupBy({
      by: ['productId'],
      where: { status: PUBLIC_REVIEW_STATUS },
      _avg: { rating: true },
      _count: { _all: true },
    })

    res.json({
      divisions: divisions.map((division) => ({
        id: division.id,
        name: division.name,
        slug: division.slug,
      })),
      categories: categories.map(publicCategory),
      products: products.map(publicProduct),
      services: services.map(publicService),
      applications: applications.map((application) => ({
        id: application.id,
        name: application.name,
        slug: application.slug,
        description: application.description,
        icon: application.icon,
      })),
      requirementTags: requirementTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        hint: tag.hint,
        icon: tag.icon,
      })),
      company: profile ? publicCompany(profile) : null,
      pages: Object.fromEntries(pages.map((page) => [page.key, publicPage(page)])),
      projects: projects.map(publicProject),
      additionalOfferings: offerings.map((offering) => ({
        id: offering.id,
        name: offering.name,
        type: offering.type,
        note: offering.note,
      })),
      ratings: Object.fromEntries(
        ratingRows.map((row) => [
          row.productId,
          { average: Number((row._avg.rating ?? 0).toFixed(2)), count: row._count._all },
        ]),
      ),
      generatedAt: new Date().toISOString(),
    })
  }),
)

/* ---------------------------------------------------------------- Projects */

publicRouter.get(
  '/projects/:slug',
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findFirst({
      where: { slug: param(req, 'slug'), ...published },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        products: { include: { product: true } },
      },
    })
    // An unpublished project is a 404 publicly — it must not be
    // distinguishable from one that never existed.
    if (!project) throw ApiError.notFound('Project not found.')

    res.json({
      project: publicProject(project),
      products: project.products
        .filter((row) => row.product.status === PUBLIC_STATUS)
        .map((row) => ({
          id: row.product.id,
          name: row.product.name,
          slug: row.product.slug,
          categoryId: row.product.categoryId,
        })),
    })
  }),
)

/* ----------------------------------------------------------------- Reviews */

publicRouter.get(
  '/products/:slug/reviews',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { slug: param(req, 'slug'), ...published },
      select: { id: true },
    })
    if (!product) throw ApiError.notFound('Product not found.')

    const params = pagination(req.query as Record<string, unknown>, 10)
    const where = { productId: product.id, status: PUBLIC_REVIEW_STATUS }

    const [rows, total, summary] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
    ])

    res.json({
      ...paged(rows.map(publicReview), total, params),
      summary: {
        average: summary._count._all
          ? Number((summary._avg.rating ?? 0).toFixed(2))
          : null,
        count: summary._count._all,
      },
    })
  }),
)

const reviewSchema = z.object({
  displayName: z.string().trim().min(2, 'Please enter your name.').max(80),
  rating: z.coerce.number().int().min(1, 'Choose a rating.').max(5),
  title: z.string().trim().max(120).optional().or(z.literal('')),
  body: z
    .string()
    .trim()
    .min(20, 'Please write at least a sentence or two.')
    .max(4000, 'That review is too long.'),
  companyName: z.string().trim().max(120).optional().or(z.literal('')),
  useContext: z.string().trim().max(200).optional().or(z.literal('')),
  reference: z.string().trim().max(80).optional().or(z.literal('')),
  consent: z.literal(true, {
    message: 'Please confirm you understand the review will be moderated before publishing.',
  }),
  /*
   * Honeypot. A real person leaves this empty; naive bots fill it.
   * It accepts any value on purpose — rejecting it here would return a
   * validation error naming the field, which tells the bot exactly what
   * caught it. The handler drops the submission silently instead.
   */
  website: z.string().max(200).optional(),
})

publicRouter.post(
  '/products/:slug/reviews',
  reviewLimiter,
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { slug: param(req, 'slug'), ...published },
      select: { id: true },
    })
    if (!product) throw ApiError.notFound('Product not found.')

    const input = reviewSchema.parse(req.body)

    // Silently accept-and-drop obvious bot submissions so the bot gets no
    // signal about why it failed.
    if (input.website) {
      return res.status(202).json({ status: 'PENDING' })
    }

    const review = await prisma.review.create({
      data: {
        productId: product.id,
        displayName: input.displayName,
        rating: input.rating,
        title: input.title || null,
        body: input.body,
        companyName: input.companyName || null,
        useContext: input.useContext || null,
        reference: input.reference || null,
        consentAcknowledged: true,
        submitterIpHash: hashIp(req),
        // Never auto-publish. Everything enters moderation.
        status: 'PENDING',
      },
    })

    await prisma.reviewEvent.create({
      data: { reviewId: review.id, action: 'SUBMITTED' },
    })

    res.status(201).json({
      status: 'PENDING',
      message:
        'Thank you. Your review has been received and will appear once it has been checked.',
    })
  }),
)

publicRouter.post(
  '/reviews/:id/report',
  reportLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      reason: z.string().trim().min(3).max(200),
      note: z.string().trim().max(1000).optional().or(z.literal('')),
    })
    const input = schema.parse(req.body)

    // Only a published review can be reported; anything else would confirm
    // the existence of content the reporter should not know about.
    const review = await prisma.review.findFirst({
      where: { id: param(req, 'id'), status: PUBLIC_REVIEW_STATUS },
      select: { id: true },
    })
    if (!review) throw ApiError.notFound('Review not found.')

    await prisma.reviewReport.create({
      data: { reviewId: review.id, reason: input.reason, reporterNote: input.note || null },
    })
    await prisma.reviewEvent.create({
      data: { reviewId: review.id, action: 'REPORTED', reason: input.reason },
    })

    res.status(201).json({ message: 'Thank you — this review has been flagged for review.' })
  }),
)

/* --------------------------------------------------------------- Enquiries */

const enquirySchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(120),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  phone: z
    .string()
    .trim()
    .min(6, 'A contact number is needed so we can respond.')
    .max(24)
    .refine((value) => /^[\d+\s()-]+$/.test(value), 'Enter a valid phone number.'),
  whatsapp: z.string().trim().max(24).optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email address.').max(160).optional().or(z.literal('')),
  projectType: z.string().trim().max(80).optional().or(z.literal('')),
  deliveryLocation: z.string().trim().max(200).optional().or(z.literal('')),
  requirementDate: z.string().trim().max(40).optional().or(z.literal('')),
  notes: z.string().trim().max(4000).optional().or(z.literal('')),
  source: z.string().trim().max(200).optional().or(z.literal('')),
  items: z
    .array(
      z.object({
        productName: z.string().trim().min(1).max(160),
        productId: z.string().trim().max(40).optional().or(z.literal('')),
        quantity: z.string().trim().max(120).optional().or(z.literal('')),
        specification: z.string().trim().max(400).optional().or(z.literal('')),
      }),
    )
    .max(30)
    .default([]),
  // Honeypot — see the note on the review schema above.
  website: z.string().max(200).optional(),
})

/**
 * Submitting an enquiry requires a verified phone.
 *
 * `requireVerifiedCustomer` is the enforcement point: it accepts only a live
 * customer session cookie, which is issued by exactly one thing — a
 * successful OTP verification. There is no field in the request body that
 * can stand in for it, so a client cannot assert its own verification.
 *
 * `requireCustomerCsrf` then stops a third-party page from spending a
 * visitor's session on their behalf.
 */
publicRouter.post(
  '/enquiries',
  enquiryLimiter,
  requireVerifiedCustomer,
  requireCustomerCsrf,
  asyncHandler(async (req, res) => {
    const input = enquirySchema.parse(req.body)

    if (input.website) {
      return res.status(202).json({ status: 'RECEIVED' })
    }

    const customer = req.customer!

    /*
     * The enquiry is recorded against the number that was actually proved,
     * not the one typed into the form. Otherwise a visitor could verify
     * their own phone and then submit an enquiry under someone else's.
     */
    const submittedPhone = normalisePhone(input.phone)
    if (submittedPhone && submittedPhone !== customer.phone) {
      throw new ApiError(
        409,
        'PHONE_MISMATCH',
        'This enquiry uses a different number from the one you verified. Please verify that number, or use the verified one.',
      )
    }

    // Only link a product id that actually refers to a published product, so
    // a caller cannot probe for draft ids through this endpoint.
    const ids = input.items.map((item) => item.productId).filter(Boolean) as string[]
    const valid = ids.length
      ? new Set(
          (
            await prisma.product.findMany({
              where: { id: { in: ids }, ...published },
              select: { id: true },
            })
          ).map((row) => row.id),
        )
      : new Set<string>()

    const enquiry = await prisma.enquiry.create({
      data: {
        name: input.name,
        company: input.company || null,
        // Stored in the proved E.164 form, so admins can dial it directly.
        phone: customer.phone,
        whatsapp: input.whatsapp || null,
        email: input.email || null,
        projectType: input.projectType || null,
        deliveryLocation: input.deliveryLocation || null,
        requirementDate: input.requirementDate || null,
        notes: input.notes || null,
        source: input.source || null,
        status: 'NEW',
        // Both set by the server from the session, never from the body.
        phoneVerified: true,
        customerId: customer.id,
        items: {
          create: input.items.map((item) => ({
            productName: item.productName,
            productId: item.productId && valid.has(item.productId) ? item.productId : null,
            quantity: item.quantity || null,
            specification: item.specification || null,
          })),
        },
      },
      select: { id: true, createdAt: true },
    })

    res.status(201).json({
      status: 'RECEIVED',
      reference: enquiry.id.slice(-8).toUpperCase(),
      message: 'Your requirement has been received.',
    })
  }),
)
