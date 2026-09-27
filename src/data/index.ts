import { categories, divisions, products, services } from './catalogue'
import { applicationBySlug, applications, requirementTagBySlug, requirementTags } from './taxonomy'
import type { Application, Product, ProductCategory, RequirementTag, Service } from './types'

export * from './types'
export { companyConfig, additionalOfferings, confirmedAdditionalOfferings } from './company'
export { divisions, categories, products, services } from './catalogue'
export {
  applications,
  requirementTags,
  projectTypes,
  applicationBySlug,
  requirementTagBySlug,
} from './taxonomy'
export type { ProjectType } from './taxonomy'
export { projects, activeProjects } from './projects'

/* ------------------------------------------------------------------ *
 * Catalogue selectors
 * Components read the catalogue through these helpers only, so filtering
 * rules live in one place and stay consistent across every page.
 * ------------------------------------------------------------------ */

export const activeProducts = products.filter((p) => p.isActive)
export const activeServices = services.filter((s) => s.isActive)

const categoryById = new Map(categories.map((c) => [c.id, c]))
const categoryBySlug = new Map(categories.map((c) => [c.slug, c]))
const productById = new Map(products.map((p) => [p.id, p]))
const productBySlug = new Map(products.map((p) => [p.slug, p]))
const serviceBySlug = new Map(services.map((s) => [s.slug, s]))

export const productCategories = categories.filter((c) => c.divisionId === 'div-products')

export function getCategoryBySlug(slug?: string): ProductCategory | undefined {
  return slug ? categoryBySlug.get(slug) : undefined
}

export function getCategoryById(id: string): ProductCategory | undefined {
  return categoryById.get(id)
}

export function getProductById(id: string): Product | undefined {
  return productById.get(id)
}

export function getProductBySlug(slug?: string): Product | undefined {
  return slug ? productBySlug.get(slug) : undefined
}

export function getServiceBySlug(slug?: string): Service | undefined {
  return slug ? serviceBySlug.get(slug) : undefined
}

export function getProductsByCategory(categoryId: string): Product[] {
  return activeProducts.filter((p) => p.categoryId === categoryId)
}

export function getProductsByCategorySlug(slug?: string): Product[] {
  const category = getCategoryBySlug(slug)
  return category ? getProductsByCategory(category.id) : []
}

export function getCategoryForProduct(product: Product): ProductCategory | undefined {
  return categoryById.get(product.categoryId)
}

/** Display name for titles/metadata, falling back to the catalogue name. */
export function productDisplayName(product: Product): string {
  return product.seoName ?? product.name
}

/**
 * Related products: the curated list where one exists, topped up with
 * same-category siblings so the block is never thin or empty.
 */
export function getRelatedProducts(product: Product, limit = 3): Product[] {
  const curated = product.relatedProducts
    .map((id) => productById.get(id))
    .filter((p): p is Product => Boolean(p?.isActive))

  const siblings = getProductsByCategory(product.categoryId).filter((p) => p.id !== product.id)

  const seen = new Set<string>([product.id])
  const out: Product[] = []
  for (const candidate of [...curated, ...siblings]) {
    if (seen.has(candidate.id)) continue
    seen.add(candidate.id)
    out.push(candidate)
    if (out.length === limit) break
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Discovery selectors — driven purely by product tags
 * ------------------------------------------------------------------ */

export function getProductsByRequirementTag(tagSlug: string): Product[] {
  return activeProducts.filter((p) => p.requirementTags.includes(tagSlug))
}

export function getServicesByRequirementTag(tagSlug: string): Service[] {
  return activeServices.filter((s) => s.requirementTags.includes(tagSlug))
}

export function getProductsByApplication(applicationSlug: string): Product[] {
  return activeProducts.filter((p) => p.applications.includes(applicationSlug))
}

export function getServicesByApplication(applicationSlug: string): Service[] {
  return activeServices.filter((s) => s.applications.includes(applicationSlug))
}

export type CatalogueMatch =
  | { kind: 'product'; product: Product; category: ProductCategory | undefined }
  | { kind: 'service'; service: Service }

/** Products and services matching a requirement tag, in catalogue order. */
export function getMatchesByRequirementTag(tagSlug: string): CatalogueMatch[] {
  return [
    ...getProductsByRequirementTag(tagSlug).map(
      (product): CatalogueMatch => ({
        kind: 'product',
        product,
        category: categoryById.get(product.categoryId),
      }),
    ),
    ...getServicesByRequirementTag(tagSlug).map(
      (service): CatalogueMatch => ({ kind: 'service', service }),
    ),
  ]
}

export function getMatchesByApplication(applicationSlug: string): CatalogueMatch[] {
  return [
    ...getProductsByApplication(applicationSlug).map(
      (product): CatalogueMatch => ({
        kind: 'product',
        product,
        category: categoryById.get(product.categoryId),
      }),
    ),
    ...getServicesByApplication(applicationSlug).map(
      (service): CatalogueMatch => ({ kind: 'service', service }),
    ),
  ]
}

export function countMatchesByRequirementTag(tagSlug: string): number {
  return getMatchesByRequirementTag(tagSlug).length
}

export function countMatchesByApplication(applicationSlug: string): number {
  return getMatchesByApplication(applicationSlug).length
}

/** Resolve tag/application slugs stored on a product into display objects. */
export function resolveApplications(slugs: string[]): Application[] {
  return slugs.map((slug) => applicationBySlug.get(slug)).filter((a): a is Application => Boolean(a))
}

export function resolveRequirementTags(slugs: string[]): RequirementTag[] {
  return slugs
    .map((slug) => requirementTagBySlug.get(slug))
    .filter((t): t is RequirementTag => Boolean(t))
}

/** Applications represented anywhere in a category, for category pages. */
export function getApplicationsForCategory(categoryId: string): Application[] {
  const slugs = new Set(getProductsByCategory(categoryId).flatMap((p) => p.applications))
  return applications.filter((a) => slugs.has(a.slug))
}

export function getRequirementTagsForCategory(categoryId: string): RequirementTag[] {
  const slugs = new Set(getProductsByCategory(categoryId).flatMap((p) => p.requirementTags))
  return requirementTags.filter((t) => slugs.has(t.slug))
}

/** Flat list of every quotable item, used to populate the quote form. */
export function getQuotableItems(): { value: string; label: string; group: string }[] {
  const productOptions = productCategories.flatMap((category) =>
    getProductsByCategory(category.id).map((product) => ({
      value: productDisplayName(product),
      label: productDisplayName(product),
      group: category.name,
    })),
  )
  const serviceOptions = activeServices.map((service) => ({
    value: service.name,
    label: service.name,
    group: 'Services',
  }))
  return [...productOptions, ...serviceOptions]
}

export { divisions as allDivisions }
