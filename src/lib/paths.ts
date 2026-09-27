import { getCategoryForProduct } from '../data'
import type { Product, ProductCategory, Service } from '../data/types'

/** Every internal URL is built here so routes and links can never drift. */
export const paths = {
  home: '/',
  products: '/products',
  category: (categorySlug: string) => `/products/${categorySlug}`,
  product: (categorySlug: string, productSlug: string) => `/products/${categorySlug}/${productSlug}`,
  services: '/services',
  service: (serviceSlug: string) => `/services/${serviceSlug}`,
  projects: '/projects',
  about: '/about',
  contact: '/contact',
  requestQuote: '/request-quote',
} as const

export function categoryUrl(category: ProductCategory): string {
  return paths.category(category.slug)
}

export function productUrl(product: Product): string {
  const category = getCategoryForProduct(product)
  return paths.product(category?.slug ?? 'products', product.slug)
}

export function serviceUrl(service: Service): string {
  return paths.service(service.slug)
}

/**
 * Deep link into the quote form with the item pre-selected, so a
 * "Get a Quote" click from a product card does not lose context.
 */
export function quoteUrlFor(itemName?: string): string {
  return itemName
    ? `${paths.requestQuote}?product=${encodeURIComponent(itemName)}`
    : paths.requestQuote
}

/** Deep link into the homepage requirement finder for a given tag. */
export function finderUrl(tagSlug: string): string {
  return `${paths.products}?requirement=${encodeURIComponent(tagSlug)}`
}

export function applicationUrl(applicationSlug: string): string {
  return `${paths.products}?application=${encodeURIComponent(applicationSlug)}`
}
