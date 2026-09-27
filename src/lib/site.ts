import { companyConfig } from '../data/company'

/**
 * Canonical origin resolution for the browser bundle.
 *
 * The production domain is a business fact, not a code constant: it is set in
 * the admin panel (Company & Contact → "Production website URL") and arrives
 * here through the CMS hydration in content/store.ts.
 *
 * Until it is set we fall back to the origin the page is actually served
 * from. That is correct on the real domain and harmless on a preview build.
 * What we deliberately do NOT do is hardcode a guessed domain — a wrong
 * canonical URL points search engines at a site that does not exist, and is
 * far worse than a self-referential one.
 *
 * `server/src/routes/sitemap.ts` resolves the same value independently, from
 * the database rather than the bundle, and refuses to emit a sitemap at all
 * when it is unset.
 */

/** Configured origin, the served origin, or '' when neither is available. */
export function siteOrigin(): string {
  const configured = companyConfig.siteUrl?.trim()
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin
    } catch {
      // Malformed value in the CMS — fall through rather than throw during render.
    }
  }

  // Undefined during the SSR smoke build, which has no location.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return ''
}

/**
 * Absolute URL for a root-relative path. Falls back to the path itself when
 * no origin is known, so callers emit a valid relative URL instead of one
 * built on an invented host.
 */
export function absoluteUrl(path: string): string {
  const origin = siteOrigin()
  if (!origin) return path
  try {
    return new URL(path, origin).toString()
  } catch {
    return path
  }
}

/**
 * Stable schema.org node identifier, e.g. "#organization".
 *
 * Fragment-only `@id`s resolve against the containing document, so the graph
 * still links up correctly before the domain is configured.
 */
export function schemaId(fragment: string): string {
  const origin = siteOrigin()
  return origin ? `${origin}/#${fragment}` : `#${fragment}`
}
