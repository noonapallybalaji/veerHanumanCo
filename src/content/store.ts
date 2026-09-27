import { categories, products, services } from '../data/catalogue'
import { additionalOfferings, companyConfig } from '../data/company'
import { applications, requirementTags } from '../data/taxonomy'
import { projects } from '../data/projects'
import type { AdditionalOffering, ProjectReference } from '../data/types'
import { api, assetUrl } from '../lib/api'

/**
 * RUNTIME CONTENT STORE
 * =====================
 *
 * The site's content lives in the CMS database. This module fetches the
 * published bundle once at boot and writes it into the seed modules
 * IN PLACE, so the ~34 files that already import from `../data` keep working
 * unchanged and keep their synchronous selector API.
 *
 * Why in-place instead of a React context:
 *   - The catalogue is small (single-digit families), so one request at boot
 *     beats dozens of per-component loading states.
 *   - It avoided rewriting every consumer, which is where bugs would have
 *     come from.
 *
 * THE ONE RULE THIS DEPENDS ON
 * ----------------------------
 * `hydrate()` must finish BEFORE any module that reads content is imported.
 * src/main.tsx enforces this by awaiting hydrate() and only then
 * dynamically importing the app. Do not add a static import of the app (or
 * of ../data) to main.tsx, or module-level values such as
 * `contact.ts`'s `hasPhone` would be computed against the seed.
 *
 * If the API is unreachable the seed modules are left as they are and the
 * site renders the last-known-good snapshot that shipped with the build.
 * `getContentSource()` reports which of the two is in use; nothing silently
 * pretends stale content is live, and the fallback is never written back to
 * the database.
 */

export type ContentSource = 'api' | 'seed'

interface RatingSummary {
  average: number
  count: number
}

export interface PageSection {
  id: string
  type: string
  data: Record<string, unknown>
}

export interface PageContent {
  key: string
  title: string
  seoTitle: string
  seoDescription: string
  sections: PageSection[]
}

let source: ContentSource = 'seed'
let fetchedAt: string | null = null
let ratings: Record<string, RatingSummary> = {}
let pages: Record<string, PageContent> = {}

export function getContentSource(): ContentSource {
  return source
}

export function getContentFetchedAt(): string | null {
  return fetchedAt
}

/** Published rating summary for a product, or null when it has no reviews. */
export function getRating(productId: string): RatingSummary | null {
  const entry = ratings[productId]
  return entry && entry.count > 0 ? entry : null
}

export function getPage(key: string): PageContent | null {
  return pages[key] ?? null
}

/**
 * Reads a field from a managed page section, falling back to the value the
 * component already ships. Editors can therefore leave a field blank and
 * get the designed default rather than an empty heading.
 */
export function sectionText(
  pageKey: string,
  sectionType: string,
  field: string,
  fallback: string,
): string {
  const section = getPage(pageKey)?.sections.find((item) => item.type === sectionType)
  const value = section?.data?.[field]
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

export function sectionList(
  pageKey: string,
  sectionType: string,
  field: string,
  fallback: string[],
): string[] {
  const section = getPage(pageKey)?.sections.find((item) => item.type === sectionType)
  const value = section?.data?.[field]
  return Array.isArray(value) && value.length > 0 ? (value as string[]) : fallback
}

/** True when the editor has switched a homepage/about section off. */
export function isSectionEnabled(pageKey: string, sectionType: string): boolean {
  const page = getPage(pageKey)
  // Before hydration (or if the page has no managed record) everything shows,
  // so the site never renders blank because the CMS was unreachable.
  if (!page || page.sections.length === 0) return true
  return page.sections.some((section) => section.type === sectionType)
}

/* ------------------------------------------------------------------ *
 * Hydration
 * ------------------------------------------------------------------ */

interface ContentResponse {
  categories: unknown[]
  products: unknown[]
  services: unknown[]
  applications: unknown[]
  requirementTags: unknown[]
  company: Record<string, unknown> | null
  pages: Record<string, PageContent>
  projects: unknown[]
  additionalOfferings: AdditionalOffering[]
  ratings: Record<string, RatingSummary>
  generatedAt: string
}

/** Replaces an array's contents without breaking existing references. */
function replaceInPlace<T>(target: T[], next: T[]) {
  target.length = 0
  target.push(...next)
}

/** Rewrites media paths to absolute URLs when the API is on another origin. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withAssetUrls(item: any) {
  return {
    ...item,
    image: assetUrl(item.image),
    gallery: Array.isArray(item.gallery)
      ? item.gallery.map((entry: unknown) =>
          typeof entry === 'string' ? assetUrl(entry) : { ...(entry as object), url: assetUrl((entry as { url?: string }).url) },
        )
      : [],
  }
}

/**
 * How long to wait for the CMS before giving up and rendering the bundled
 * snapshot. The app is imported only after this resolves, so without a bound
 * a hanging or unreachable API would leave the visitor on a blank page
 * indefinitely — far worse than slightly stale content.
 */
const HYDRATE_TIMEOUT_MS = 4000

export async function hydrate(signal?: AbortSignal): Promise<ContentSource> {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), HYDRATE_TIMEOUT_MS)
  // Honour a caller-supplied signal as well as the timeout.
  signal?.addEventListener('abort', () => timeout.abort(), { once: true })

  try {
    const data = await api.get<ContentResponse>('/api/public/content', timeout.signal)

    // Guard against a technically-successful response that would blank the
    // site: an empty catalogue almost certainly means something is wrong
    // upstream, so keep the seed rather than render nothing.
    if (!Array.isArray(data.products) || data.products.length === 0) {
      console.warn('[content] API returned no products; keeping the bundled snapshot.')
      return 'seed'
    }

    replaceInPlace(categories as unknown[], (data.categories ?? []).map(withAssetUrls))
    replaceInPlace(products as unknown[], (data.products ?? []).map(withAssetUrls))
    replaceInPlace(services as unknown[], (data.services ?? []).map(withAssetUrls))
    replaceInPlace(applications as unknown[], data.applications ?? [])
    replaceInPlace(requirementTags as unknown[], data.requirementTags ?? [])
    replaceInPlace(
      projects as ProjectReference[],
      ((data.projects ?? []) as ProjectReference[]).map(withAssetUrls),
    )
    replaceInPlace(additionalOfferings, data.additionalOfferings ?? [])

    if (data.company) {
      // Mutated in place so modules holding a reference see the live values.
      Object.assign(companyConfig, data.company)
    }

    ratings = data.ratings ?? {}
    pages = data.pages ?? {}
    fetchedAt = data.generatedAt ?? new Date().toISOString()
    source = 'api'
    return 'api'
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError'
    console.warn(
      aborted
        ? `[content] CMS did not respond within ${HYDRATE_TIMEOUT_MS}ms; rendering the snapshot bundled with this build.`
        : '[content] Could not reach the CMS API; rendering the snapshot bundled with this build.',
      aborted ? '' : (error as Error).message,
    )
    return 'seed'
  } finally {
    clearTimeout(timer)
  }
}
