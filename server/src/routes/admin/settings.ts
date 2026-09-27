import { param } from '../../lib/util.js'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, asyncHandler } from '../../lib/errors.js'
import {
  ABOUT_SECTION_TYPES,
  HOME_SECTION_TYPES,
  OFFERING_STATUSES,
  PAGE_KEYS,
} from '../../lib/constants.js'
import { stringifyJson } from '../../lib/json.js'
import { requirePermission } from '../../auth/middleware.js'
import { recordAudit } from '../../services/audit.js'
import { snapshot } from '../../services/versions.js'
import { adminCompany, adminPage } from '../../services/serialize.js'
import { applyTransition, TRANSITIONS, type Transition } from './lifecycle.js'

export const settingsRouter = Router()

/* ------------------------------------------------------- Company profile */

/**
 * Contact details are optional on purpose. Empty means "not supplied yet",
 * and the public site hides the matching action rather than rendering a
 * dead link. A number is only validated when one is actually entered.
 */
const optionalPhone = z
  .string()
  .trim()
  .max(24)
  .refine((value) => value === '' || /^[\d+][\d\s()-]{5,}$/.test(value), 'Enter a valid phone number.')
  .optional()
  .or(z.literal(''))

const companyBody = z.object({
  companyName: z.string().trim().min(2, 'Enter the company name.').max(160),
  alternateName: z.string().trim().max(160).optional().or(z.literal('')),
  proprietor: z.string().trim().max(160).optional().or(z.literal('')),
  establishedYear: z.coerce
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear())
    .nullable()
    .optional(),
  businessStructure: z.string().trim().max(120).optional().or(z.literal('')),
  natureOfBusiness: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  gstin: z
    .string()
    .trim()
    .max(20)
    .refine(
      (value) => value === '' || /^[0-9A-Z]{15}$/.test(value.toUpperCase()),
      'A GSTIN is 15 characters.',
    )
    .optional()
    .or(z.literal('')),

  phone: optionalPhone,
  whatsapp: optionalPhone,
  email: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Enter a valid email address.')
    .optional()
    .or(z.literal('')),

  addressLabel: z.string().trim().max(80).default('Office'),
  addressLines: z.array(z.string().trim().max(200)).max(6).default([]),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  state: z.string().trim().max(80).optional().or(z.literal('')),
  postalCode: z.string().trim().max(16).optional().or(z.literal('')),
  country: z.string().trim().max(80).default('India'),

  warehouseLabel: z.string().trim().max(80).default('Additional location'),
  warehouseLines: z.array(z.string().trim().max(200)).max(6).default([]),
  warehouseCity: z.string().trim().max(80).optional().or(z.literal('')),
  warehouseState: z.string().trim().max(80).optional().or(z.literal('')),
  warehousePostalCode: z.string().trim().max(16).optional().or(z.literal('')),

  businessHours: z
    .array(z.object({ days: z.string().trim().min(1).max(80), hours: z.string().trim().min(1).max(80) }))
    .max(8)
    .default([]),
  mapsUrl: z
    .string()
    .trim()
    .max(600)
    .refine((value) => value === '' || /^https:\/\//.test(value), 'Use a full https:// link.')
    .optional()
    .or(z.literal('')),
  socialLinks: z
    .array(
      z.object({
        platform: z.string().trim().min(1).max(40),
        url: z.string().trim().url('Enter a full URL.').max(400),
      }),
    )
    .max(10)
    .default([]),
  siteUrl: z
    .string()
    .trim()
    .max(300)
    .refine((value) => value === '' || /^https?:\/\//.test(value), 'Use a full https:// link.')
    .optional()
    .or(z.literal('')),

  showProprietor: z.boolean().default(false),
  showGstin: z.boolean().default(false),
  showWarehouseAddress: z.boolean().default(false),
})

settingsRouter.get(
  '/company',
  requirePermission('content:read'),
  asyncHandler(async (_req, res) => {
    const profile = await prisma.companyProfile.findUnique({ where: { id: 'singleton' } })
    if (!profile) throw ApiError.notFound('Company profile has not been initialised.')
    res.json({ company: adminCompany(profile) })
  }),
)

settingsRouter.put(
  '/company',
  requirePermission('company:write'),
  asyncHandler(async (req, res) => {
    const input = companyBody.parse(req.body)
    const existing = await prisma.companyProfile.findUnique({ where: { id: 'singleton' } })
    if (!existing) throw ApiError.notFound('Company profile has not been initialised.')

    await snapshot('CompanyProfile', 'singleton', adminCompany(existing), req.user!.id, 'Before edit')

    const profile = await prisma.companyProfile.update({
      where: { id: 'singleton' },
      data: {
        companyName: input.companyName,
        alternateName: input.alternateName || null,
        proprietor: input.proprietor || null,
        establishedYear: input.establishedYear ?? null,
        businessStructure: input.businessStructure || null,
        natureOfBusiness: stringifyJson(input.natureOfBusiness),
        gstin: input.gstin ? input.gstin.toUpperCase() : null,
        phone: input.phone ?? '',
        whatsapp: input.whatsapp ?? '',
        email: input.email ?? '',
        addressLabel: input.addressLabel,
        addressLines: stringifyJson(input.addressLines),
        city: input.city ?? '',
        state: input.state ?? '',
        postalCode: input.postalCode ?? '',
        country: input.country,
        warehouseLabel: input.warehouseLabel,
        warehouseLines: stringifyJson(input.warehouseLines),
        warehouseCity: input.warehouseCity ?? '',
        warehouseState: input.warehouseState ?? '',
        warehousePostalCode: input.warehousePostalCode ?? '',
        businessHours: stringifyJson(input.businessHours),
        mapsUrl: input.mapsUrl || null,
        socialLinks: stringifyJson(input.socialLinks),
        siteUrl: input.siteUrl ?? '',
        showProprietor: input.showProprietor,
        showGstin: input.showGstin,
        showWarehouseAddress: input.showWarehouseAddress,
      },
    })

    await recordAudit(req, {
      action: 'COMPANY_UPDATED',
      entityType: 'CompanyProfile',
      entityId: 'singleton',
      summary: 'Updated company profile and contact details',
      before: {
        phone: existing.phone,
        whatsapp: existing.whatsapp,
        email: existing.email,
        showProprietor: existing.showProprietor,
        showGstin: existing.showGstin,
      },
      after: {
        phone: profile.phone,
        whatsapp: profile.whatsapp,
        email: profile.email,
        showProprietor: profile.showProprietor,
        showGstin: profile.showGstin,
      },
    })

    res.json({ company: adminCompany(profile) })
  }),
)

/* --------------------------------------------------- Additional offerings */

settingsRouter.get(
  '/offerings',
  requirePermission('content:read'),
  asyncHandler(async (_req, res) => {
    const offerings = await prisma.additionalOffering.findMany({ orderBy: { displayOrder: 'asc' } })
    res.json({ offerings })
  }),
)

settingsRouter.put(
  '/offerings/:id',
  requirePermission('company:write'),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      status: z.enum(OFFERING_STATUSES),
      note: z.string().trim().max(400).optional(),
    })
    const input = schema.parse(req.body)

    const existing = await prisma.additionalOffering.findUnique({ where: { id: param(req, 'id') } })
    if (!existing) throw ApiError.notFound('Offering not found.')

    const offering = await prisma.additionalOffering.update({
      where: { id: param(req, 'id') },
      data: { status: input.status, note: input.note ?? existing.note },
    })

    await recordAudit(req, {
      action: 'OFFERING_STATUS_CHANGED',
      entityType: 'AdditionalOffering',
      entityId: offering.id,
      summary: `Set "${offering.name}" to ${offering.status}`,
      before: { status: existing.status },
      after: { status: offering.status },
    })

    res.json({ offering })
  }),
)

/* ------------------------------------------------------------ Page content */

const sectionSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  enabled: z.boolean().default(true),
  /**
   * Section fields are a flat record of primitives and string arrays.
   * Rejecting nested objects and long strings keeps a compromised or
   * careless editor from smuggling markup or huge payloads into a page —
   * there is deliberately no rich-HTML section type anywhere.
   */
  data: z.record(
    z.string().max(60),
    z.union([
      z.string().max(6000),
      z.number(),
      z.boolean(),
      z.array(z.string().max(600)).max(30),
    ]),
  ),
})

const pageBody = z.object({
  title: z.string().trim().min(2).max(200),
  seoTitle: z.string().trim().max(200).optional().or(z.literal('')),
  seoDescription: z.string().trim().max(400).optional().or(z.literal('')),
  sections: z.array(sectionSchema).max(40),
})

function allowedTypes(key: string): readonly string[] {
  return key === 'home' ? HOME_SECTION_TYPES : ABOUT_SECTION_TYPES
}

settingsRouter.get(
  '/pages/:key',
  requirePermission('content:read'),
  asyncHandler(async (req, res) => {
    if (!PAGE_KEYS.includes(param(req, 'key') as never)) throw ApiError.notFound('Unknown page.')
    const page = await prisma.contentPage.findUnique({
      where: { key: param(req, 'key') },
      include: { sections: true },
    })
    if (!page) throw ApiError.notFound('Page not found.')
    res.json({ page: adminPage(page), availableSections: allowedTypes(param(req, 'key')) })
  }),
)

settingsRouter.put(
  '/pages/:key',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    if (!PAGE_KEYS.includes(param(req, 'key') as never)) throw ApiError.notFound('Unknown page.')
    const input = pageBody.parse(req.body)

    const permitted = allowedTypes(param(req, 'key'))
    const invalid = input.sections.filter((section) => !permitted.includes(section.type))
    if (invalid.length > 0) {
      throw ApiError.badRequest(
        `Unsupported section type: ${invalid.map((section) => section.type).join(', ')}`,
      )
    }

    const existing = await prisma.contentPage.findUnique({
      where: { key: param(req, 'key') },
      include: { sections: true },
    })
    if (!existing) throw ApiError.notFound('Page not found.')

    await snapshot('ContentPage', existing.id, adminPage(existing), req.user!.id, 'Before edit')

    const page = await prisma.$transaction(async (tx) => {
      await tx.contentSection.deleteMany({ where: { pageId: existing.id } })
      return tx.contentPage.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          seoTitle: input.seoTitle || null,
          seoDescription: input.seoDescription || null,
          sections: {
            create: input.sections.map((section, index) => ({
              type: section.type,
              enabled: section.enabled,
              displayOrder: index,
              data: stringifyJson(section.data),
            })),
          },
        },
        include: { sections: true },
      })
    })

    await recordAudit(req, {
      action: 'PAGE_UPDATED',
      entityType: 'ContentPage',
      entityId: page.id,
      summary: `Updated "${page.key}" page content`,
    })

    res.json({ page: adminPage(page) })
  }),
)

settingsRouter.post(
  '/pages/:key/:action',
  requirePermission('content:write'),
  asyncHandler(async (req, res) => {
    const action = param(req, 'action') as Transition
    if (!TRANSITIONS.includes(action)) throw ApiError.notFound('Unknown action.')
    if (!PAGE_KEYS.includes(param(req, 'key') as never)) throw ApiError.notFound('Unknown page.')

    const existing = await prisma.contentPage.findUnique({
      where: { key: param(req, 'key') },
      include: { sections: true },
    })
    if (!existing) throw ApiError.notFound('Page not found.')

    const next = applyTransition(req, existing.status, action)
    const page = await prisma.contentPage.update({
      where: { id: existing.id },
      data: next,
      include: { sections: true },
    })

    await recordAudit(req, {
      action: `PAGE_${action.toUpperCase().replace('-', '_')}`,
      entityType: 'ContentPage',
      entityId: page.id,
      summary: `${action} the "${page.key}" page`,
      before: { status: existing.status },
      after: { status: page.status },
    })

    res.json({ page: adminPage(page) })
  }),
)
