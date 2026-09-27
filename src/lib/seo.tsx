import { useEffect } from 'react'
import { companyConfig } from '../data/company'
import { absoluteUrl } from './site'

/**
 * Minimal head manager. Avoids a helmet dependency: it upserts the tags we
 * actually need and removes the JSON-LD it added on unmount, so pages never
 * leak each other's structured data.
 */

interface SeoProps {
  /** Page title without the company suffix — the suffix is added here. */
  title: string
  description: string
  /** Path only, e.g. "/products/rcc". Combined with the origin from lib/site. */
  path: string
  /** Absolute or root-relative image for Open Graph. */
  image?: string
  /** "website" for pages, "article" where appropriate. */
  type?: string
  /** One or more schema.org objects to emit as JSON-LD. */
  schema?: object | object[]
  /** Set for pages that must not be indexed. */
  noIndex?: boolean
  /** Pass the full title verbatim, skipping the company suffix. */
  exactTitle?: boolean
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

const SCHEMA_ID = 'page-structured-data'

export function Seo({
  title,
  description,
  path,
  image,
  type = 'website',
  schema,
  noIndex = false,
  exactTitle = false,
}: SeoProps) {
  // Callers build schema objects inline, so depend on the serialised form
  // instead of object identity to avoid re-writing the head every render.
  const schemaJson = schema ? JSON.stringify(Array.isArray(schema) ? schema : [schema]) : ''

  useEffect(() => {
    const fullTitle = exactTitle ? title : `${title} | ${companyConfig.companyName}`
    const canonical = absoluteUrl(path)
    const ogImage = image ? absoluteUrl(image) : undefined

    document.title = fullTitle
    upsertMeta('name', 'description', description)
    upsertLink('canonical', canonical)
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow')

    upsertMeta('property', 'og:site_name', companyConfig.companyName)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', canonical)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:locale', 'en_IN')
    if (ogImage) upsertMeta('property', 'og:image', ogImage)

    upsertMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
    if (ogImage) upsertMeta('name', 'twitter:image', ogImage)

    document.getElementById(SCHEMA_ID)?.remove()
    if (schemaJson) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = SCHEMA_ID
      script.textContent = schemaJson
      document.head.appendChild(script)
    }

    return () => {
      document.getElementById(SCHEMA_ID)?.remove()
    }
  }, [title, description, path, image, type, schemaJson, noIndex, exactTitle])

  return null
}
