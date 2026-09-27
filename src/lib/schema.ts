import { companyConfig } from '../data/company'
import type { Product, ProductCategory, Service } from '../data/types'
import { productDisplayName } from '../data'
import { absoluteUrl, schemaId, siteOrigin } from './site'

/**
 * schema.org builders.
 *
 * Rule: only emit fields we actually know. No telephone unless configured,
 * no geo coordinates, no reviews, no aggregateRating, no price or
 * priceRange, no certifications. Google penalises fabricated markup and
 * the business has not supplied any of it.
 */

function postalAddress() {
  return {
    '@type': 'PostalAddress',
    streetAddress: companyConfig.address.lines.join(', '),
    addressLocality: companyConfig.address.city,
    addressRegion: companyConfig.address.state,
    postalCode: companyConfig.address.postalCode,
    addressCountry: 'IN',
  }
}

function openingHoursSpecification() {
  // Monday–Saturday 09:30–18:00, closed Sunday. Sourced from businessHours.
  return [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ],
      opens: '09:30',
      closes: '18:00',
    },
  ]
}

export function organizationSchema() {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': schemaId('organization'),
    name: companyConfig.companyName,
    alternateName: companyConfig.alternateName,
    description:
      'Supplier and contractor for RCC, FRP, drainage and piping products used in construction, civil infrastructure and landscaping projects in Hyderabad, Telangana.',
    foundingDate: String(companyConfig.establishedYear),
    address: postalAddress(),
    areaServed: [
      { '@type': 'City', name: 'Hyderabad' },
      { '@type': 'State', name: 'Telangana' },
    ],
    openingHoursSpecification: openingHoursSpecification(),
  }

  // Omitted rather than emitted empty while the domain is unconfigured.
  const origin = siteOrigin()
  if (origin) schema.url = origin

  if (companyConfig.phone) schema.telephone = companyConfig.phone
  if (companyConfig.email) schema.email = companyConfig.email
  if (companyConfig.disclosure.showGstin) schema.taxID = companyConfig.gstin
  if (companyConfig.disclosure.showProprietor) {
    schema.founder = { '@type': 'Person', name: companyConfig.proprietor }
  }

  return schema
}

export function websiteSchema() {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': schemaId('website'),
    name: companyConfig.companyName,
    publisher: { '@id': schemaId('organization') },
    inLanguage: 'en-IN',
  }

  const origin = siteOrigin()
  if (origin) schema.url = origin

  return schema
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function productSchema(
  product: Product,
  category: ProductCategory,
  path: string,
  /**
   * Published review summary, if the product has any. Passed in rather than
   * assumed: an aggregateRating is only emitted when real approved reviews
   * exist, because fabricated review markup is both a policy violation and
   * a manual-action risk.
   */
  rating?: { average: number; count: number } | null,
) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productDisplayName(product),
    description: product.summary,
    category: category.name,
    url: absoluteUrl(path),
    brand: { '@type': 'Brand', name: companyConfig.companyName },
    // No `offers` block: no price, currency, availability or stock was
    // supplied, and quotations are requirement-based.
    manufacturer: { '@id': schemaId('organization') },
  }

  if (product.specifications.length > 0) {
    schema.additionalProperty = product.specifications.map((spec) => ({
      '@type': 'PropertyValue',
      name: spec.label,
      value: spec.value,
    }))
  }

  if (rating && rating.count > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.average,
      reviewCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return schema
}

export function serviceSchema(service: Service, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    serviceType: service.name,
    description: service.summary,
    url: absoluteUrl(path),
    provider: { '@id': schemaId('organization') },
    areaServed: [
      { '@type': 'City', name: 'Hyderabad' },
      { '@type': 'State', name: 'Telangana' },
    ],
  }
}

export function itemListSchema(
  name: string,
  items: { name: string; path: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  }
}
