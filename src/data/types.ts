/**
 * Domain types for the Veer Hanuman Trading Co. catalogue.
 *
 * The business hierarchy is strictly:
 *   Division -> Category -> Product
 *
 * `applications` and `requirementTags` are *discovery* dimensions only.
 * A product may carry many of either without changing where it sits in the
 * catalogue. Never re-parent a product to make a filter work.
 */

/** Top level of the catalogue: "Products" / "Services". */
export interface ProductDivision {
  id: string
  name: string
  slug: string
}

/** A product family inside a division, e.g. RCC / FRP Frame with Covers / Pipes. */
export interface ProductCategory {
  id: string
  divisionId: string
  name: string
  /** Optional shorter label for navigation and cards. */
  shortName?: string
  slug: string
  /** One-line summary used on cards and category headers. */
  summary: string
  /** Longer copy for the category page intro. Plain prose, no claims. */
  description: string
  /**
   * Replaceable photograph. Leave `null` to fall back to the built-in
   * technical illustration for `visual`. See public/images/README.md.
   */
  image: string | null
  /** Illustration variant used when `image` is null. */
  visual: VisualVariant
}

export interface ProductSpecification {
  label: string
  value: string
}

export interface Product {
  id: string
  categoryId: string
  name: string
  /**
   * Fuller name used in page titles and metadata where the short catalogue
   * name would be ambiguous on its own (e.g. "HDPE" -> "HDPE Pipes").
   * Falls back to `name`.
   */
  seoName?: string
  slug: string
  /** One-line summary for cards. */
  summary: string
  /** Paragraph(s) for the detail page. Factual, non-technical. */
  description: string
  /** Replaceable photograph, or null to use the illustration. */
  image: string | null
  /** Additional replaceable photographs for the detail gallery. */
  gallery: string[]
  visual: VisualVariant
  /**
   * Confirmed specifications only. An empty array renders
   * "Specifications available on request." Never populate with guesses.
   */
  specifications: ProductSpecification[]
  /** Plain-language notes on where the product is typically used. */
  useCases: string[]
  /** Application slugs — see data/taxonomy.ts */
  applications: string[]
  /** Requirement tag slugs — see data/taxonomy.ts */
  requirementTags: string[]
  /** Product ids. Leave empty to fall back to same-category siblings. */
  relatedProducts: string[]
  isActive: boolean
}

export interface Application {
  id: string
  name: string
  slug: string
  description: string
  icon: ApplicationIcon
}

export interface RequirementTag {
  id: string
  name: string
  slug: string
  /** Shown under the tile in the requirement finder. */
  hint: string
  icon: RequirementIcon
}

export interface Service {
  id: string
  divisionId: string
  name: string
  slug: string
  summary: string
  description: string
  image: string | null
  visual: VisualVariant
  /** Scope items shown on the service page. Only confirmed scope. */
  scope: { title: string; detail: string }[]
  applications: string[]
  requirementTags: string[]
  isActive: boolean
}

/**
 * Offerings reported by third-party business directories that the business
 * owner has not yet confirmed. `status` is internal only and must never be
 * rendered to a site visitor. Flip `status` to "confirmed" to publish.
 */
export interface AdditionalOffering {
  id: string
  name: string
  type: 'product' | 'service'
  status: 'confirmation_required' | 'confirmed'
  source: string
  /** Copy to use if and when the offering is confirmed. */
  note: string
}

export interface CompanyAddress {
  label: string
  lines: string[]
  city: string
  state: string
  postalCode: string
  country: string
  /** Only show addresses the owner has confirmed. */
  isPublished: boolean
}

export interface CompanyConfig {
  companyName: string
  alternateName: string
  proprietor: string
  establishedYear: number
  businessStructure: string
  natureOfBusiness: string[]
  gstin: string
  /** E.164 where known, e.g. "+919999999999". Empty string = not yet supplied. */
  phone: string
  /** Digits only, country code first, for wa.me links. */
  whatsapp: string
  email: string
  address: CompanyAddress
  warehouseAddress: CompanyAddress
  businessHours: { days: string; hours: string }[]
  /** Canonical origin used for canonical URLs, OG tags and the sitemap. */
  siteUrl: string
  /**
   * Third-party sourced details are hidden until the owner confirms them.
   * See data/company.ts for what each flag gates.
   */
  disclosure: {
    showProprietor: boolean
    showGstin: boolean
    showTurnover: boolean
    showEmployeeCount: boolean
    showWarehouseAddress: boolean
  }
}

/**
 * A verified project reference. The array in data/projects.ts is
 * intentionally empty — publish an entry only when the business owner has
 * supplied the details AND cleared the client for public mention.
 * Never populate this from directory listings or guesses.
 */
export interface ProjectGalleryImage {
  url: string | null
  alt: string
  caption?: string | null
}

export interface ProjectReference {
  id: string
  title: string
  slug: string
  summary: string
  description: string
  projectType?: string | null
  /** e.g. "Hyderabad, Telangana". Only if confirmed. */
  location?: string | null
  /**
   * Present only when the client agreed to be named. The API withholds it
   * otherwise, so an absent value here means "not cleared", not "unknown".
   */
  client?: string | null
  year?: number | null
  scope?: string | null
  /** Only when verified. */
  quantitySupplied?: string | null
  /** Present only when consent was recorded against the project. */
  testimonial?: { quote: string; author: string | null } | null
  /** Product ids supplied to the project. */
  products: string[]
  image: string | null
  visual: VisualVariant
  gallery?: ProjectGalleryImage[]
  featured?: boolean
  displayOrder?: number
}

/** Built-in technical illustrations. Used only when no photograph is set. */
export type VisualVariant =
  | 'rcc-chamber'
  | 'rcc-manhole-cover'
  | 'rcc-pole'
  | 'rcc-tree-guard'
  | 'frp-frame-cover'
  | 'frp-thermodrain'
  | 'frp-gully'
  | 'pipe-hdpe'
  | 'pipe-ecodrain'
  | 'pipe-dwc'
  | 'landscaping'
  | 'infrastructure'

export type ApplicationIcon =
  | 'road'
  | 'drainage'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'landscape'

export type RequirementIcon =
  | 'drainage'
  | 'manhole'
  | 'utility'
  | 'pipes'
  | 'landscape'
  | 'construction'
