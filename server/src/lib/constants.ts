/**
 * The allowed values for every String-backed "enum" column.
 *
 * SQLite has no enum type in Prisma, so the database stores plain strings
 * and THIS FILE is the authority on what those strings may be. Every write
 * path validates against these lists with zod, so an invalid status cannot
 * reach the database.
 */

export const CONTENT_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'PUBLISHED',
  'ARCHIVED',
] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

/** The only status a public endpoint may ever return. */
export const PUBLIC_STATUS: ContentStatus = 'PUBLISHED'

export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

/** The only review status shown publicly or counted in an average. */
export const PUBLIC_REVIEW_STATUS: ReviewStatus = 'APPROVED'

export const REVIEW_ACTIONS = [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'HIDDEN',
  'RESTORED',
  'EDITED',
  'REPORTED',
] as const
export type ReviewAction = (typeof REVIEW_ACTIONS)[number]

export const REPORT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const

export const ENQUIRY_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUOTED',
  'WON',
  'LOST',
  'CLOSED',
] as const
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number]

export const OFFERING_STATUSES = [
  'CONFIRMATION_REQUIRED',
  'CONFIRMED',
  'REJECTED',
] as const

export const MEDIA_KINDS = ['IMAGE', 'DOCUMENT'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

/* ------------------------------------------------------------------ *
 * Roles and permissions
 * ------------------------------------------------------------------ */

export const ROLES = ['SUPER_ADMIN', 'CONTENT_EDITOR', 'REVIEW_MODERATOR'] as const
export type Role = (typeof ROLES)[number]

/**
 * Every privileged capability in the system. Route handlers require a
 * permission, never a role, so adding a role later does not mean revisiting
 * every endpoint.
 */
export const PERMISSIONS = [
  'content:read',
  'content:write',
  'content:publish',
  'review:read',
  'review:moderate',
  'enquiry:read',
  'enquiry:write',
  'company:write',
  'media:write',
  'user:manage',
  'audit:read',
] as const
export type Permission = (typeof PERMISSIONS)[number]

/** Least privilege: each role gets only what its job needs. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  CONTENT_EDITOR: [
    'content:read',
    'content:write',
    'review:read',
    'enquiry:read',
    'media:write',
    // Deliberately NOT content:publish — an editor submits for review.
    // Deliberately NOT company:write, user:manage or audit:read.
  ],
  REVIEW_MODERATOR: [
    'review:read',
    'review:moderate',
    'content:read',
  ],
}

export function roleHas(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role as Role]
  return permissions ? permissions.includes(permission) : false
}

/* ------------------------------------------------------------------ *
 * Managed page sections
 *
 * Editors choose from these types and fill in typed fields. There is no
 * raw-HTML section on purpose: arbitrary markup from the admin panel would
 * be a stored-XSS vector on every public page.
 * ------------------------------------------------------------------ */

export const HOME_SECTION_TYPES = [
  'hero',
  'categories',
  'requirementFinder',
  'applications',
  'whyUs',
  'featuredProducts',
  'landscaping',
  'projects',
  'quoteCta',
] as const
export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number]

export const ABOUT_SECTION_TYPES = [
  'intro',
  'overview',
  'story',
  'capabilities',
  'values',
  'customers',
  'businessDetails',
] as const
export type AboutSectionType = (typeof ABOUT_SECTION_TYPES)[number]

export const PAGE_KEYS = ['home', 'about'] as const
export type PageKey = (typeof PAGE_KEYS)[number]

/** Illustration keys the frontend knows how to draw. */
export const VISUAL_VARIANTS = [
  'rcc-chamber',
  'rcc-manhole-cover',
  'rcc-pole',
  'rcc-tree-guard',
  'frp-frame-cover',
  'frp-thermodrain',
  'frp-gully',
  'pipe-hdpe',
  'pipe-ecodrain',
  'pipe-dwc',
  'landscaping',
  'infrastructure',
] as const
