import { Router } from 'express'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { PUBLIC_STATUS } from '../lib/constants.js'

/**
 * Dynamic sitemap.xml and robots.txt.
 *
 * Replaces the previous build-time generation, which read the *seed* files
 * rather than the database. That meant anything published through the CMS
 * after the last build was missing, and project URLs were never included at
 * all.
 *
 * Two rules hold here:
 *  1. Only PUBLISHED content is listed. Drafts, archived items, admin routes
 *     and API endpoints never appear.
 *  2. The origin comes from configuration, never from the request. Deriving
 *     it from the Host header would let anyone who can reach the server mint
 *     a sitemap full of absolute URLs pointing at a domain of their choosing.
 */
export const sitemapRouter = Router()

const published = { status: PUBLIC_STATUS }

/** Static routes that always exist and should be indexed. */
const STATIC_ROUTES: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/products', priority: '0.9', changefreq: 'weekly' },
  { path: '/services', priority: '0.8', changefreq: 'monthly' },
  { path: '/projects', priority: '0.7', changefreq: 'weekly' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.7', changefreq: 'monthly' },
  { path: '/request-quote', priority: '0.8', changefreq: 'monthly' },
]

/**
 * Paths that must never be listed, kept explicit so the exclusion is
 * reviewable rather than implied by what the queries happen to select.
 */
const EXCLUDED_PREFIXES = ['/admin', '/api']

/**
 * Resolves the canonical origin.
 *
 * Preference order: the CMS company profile (the field the admin panel
 * labels "production website URL", and the same value the pages use for
 * their canonical tags), then the PUBLIC_SITE_URL environment fallback.
 * Returns null when neither is a usable absolute http(s) origin — the
 * caller then refuses rather than emitting relative or guessed URLs.
 */
export async function resolveOrigin(): Promise<string | null> {
  let configured = ''
  try {
    const profile = await prisma.companyProfile.findUnique({
      where: { id: 'singleton' },
      select: { siteUrl: true },
    })
    configured = profile?.siteUrl?.trim() ?? ''
  } catch {
    // Fall through to the environment value; the caller handles a null.
  }

  const candidate = configured || (env.PUBLIC_SITE_URL ?? '').trim()
  if (!candidate) return null

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    // Origin only: strip any path, query or fragment someone pasted in.
    return url.origin
  } catch {
    return null
  }
}

/** XML text escaping. Slugs are generated, but never assume. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface SitemapEntry {
  path: string
  lastmod?: Date | null
  changefreq: string
  priority: string
}

function renderSitemap(origin: string, entries: SitemapEntry[]): string {
  const urls = entries
    .filter((entry) => !EXCLUDED_PREFIXES.some((prefix) => entry.path.startsWith(prefix)))
    .map((entry) => {
      const loc = escapeXml(`${origin}${entry.path}`)
      const lastmod = entry.lastmod
        ? `\n    <lastmod>${entry.lastmod.toISOString().slice(0, 10)}</lastmod>`
        : ''
      return (
        `  <url>\n` +
        `    <loc>${loc}</loc>${lastmod}\n` +
        `    <changefreq>${entry.changefreq}</changefreq>\n` +
        `    <priority>${entry.priority}</priority>\n` +
        `  </url>`
      )
    })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

sitemapRouter.get('/sitemap.xml', async (_req, res) => {
  const origin = await resolveOrigin()

  if (!origin) {
    // Without a trusted origin there is no correct answer. Refusing beats
    // publishing URLs on a guessed domain.
    console.error(
      '[sitemap] No canonical origin configured. Set the production website URL in Admin > Company & Contact, or PUBLIC_SITE_URL.',
    )
    res.status(503).type('text/plain').set('Retry-After', '3600')
    return res.send('Sitemap unavailable: the site origin is not configured.')
  }

  try {
    const [categories, products, services, projects, pages] = await Promise.all([
      prisma.category.findMany({
        where: published,
        select: { slug: true, updatedAt: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.product.findMany({
        where: published,
        select: { slug: true, updatedAt: true, category: { select: { slug: true, status: true } } },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.service.findMany({
        where: published,
        select: { slug: true, updatedAt: true },
        orderBy: { displayOrder: 'asc' },
      }),
      // Only published projects, by canonical slug.
      prisma.project.findMany({
        where: published,
        select: { slug: true, updatedAt: true, featured: true },
        orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }],
      }),
      prisma.contentPage.findMany({
        where: published,
        select: { key: true, updatedAt: true },
      }),
    ])

    // Managed pages carry their own lastmod for the static routes they back.
    const pageUpdated = new Map(pages.map((page) => [page.key, page.updatedAt]))

    const entries: SitemapEntry[] = [
      ...STATIC_ROUTES.map((route) => ({
        ...route,
        lastmod:
          route.path === '/'
            ? (pageUpdated.get('home') ?? null)
            : route.path === '/about'
              ? (pageUpdated.get('about') ?? null)
              : null,
      })),

      ...categories.map((category) => ({
        path: `/products/${category.slug}`,
        lastmod: category.updatedAt,
        changefreq: 'monthly',
        priority: '0.8',
      })),

      /*
       * A published product inside an unpublished family has no reachable
       * URL, so it is left out rather than listed as a soft 404.
       */
      ...products
        .filter((product) => product.category?.status === PUBLIC_STATUS)
        .map((product) => ({
          path: `/products/${product.category.slug}/${product.slug}`,
          lastmod: product.updatedAt,
          changefreq: 'monthly',
          priority: '0.7',
        })),

      ...services.map((service) => ({
        path: `/services/${service.slug}`,
        lastmod: service.updatedAt,
        changefreq: 'monthly',
        priority: '0.7',
      })),

      ...projects.map((project) => ({
        path: `/projects/${project.slug}`,
        lastmod: project.updatedAt,
        changefreq: 'monthly',
        priority: project.featured ? '0.7' : '0.6',
      })),
    ]

    res.type('application/xml; charset=utf-8')
    // Short browser cache, longer shared/CDN cache. A publish is visible
    // within minutes without a rebuild; stale-while-revalidate keeps a
    // crawler from ever waiting on a cold query.
    res.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
    res.set('X-Robots-Tag', 'noindex')
    res.send(renderSitemap(origin, entries))
  } catch (error) {
    /*
     * A 503 tells crawlers to come back, and they keep the sitemap they
     * already have. Serving a truncated one instead would wrongly signal
     * that the missing URLs had been withdrawn. The reason is logged, never
     * returned.
     */
    console.error('[sitemap] generation failed:', (error as Error).message)
    res.status(503).type('text/plain').set('Retry-After', '600')
    res.send('Sitemap temporarily unavailable.')
  }
})

sitemapRouter.get('/robots.txt', async (_req, res) => {
  const origin = await resolveOrigin()

  const lines = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Not useful to crawlers, and not public.',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
  ]

  // Only advertise a sitemap URL we can state absolutely, as the spec requires.
  if (origin) lines.push(`Sitemap: ${origin}/sitemap.xml`, '')

  res.type('text/plain; charset=utf-8')
  res.set('Cache-Control', 'public, max-age=3600')
  res.send(lines.join('\n'))
})
