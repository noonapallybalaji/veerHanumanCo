import type { Prisma } from '@prisma/client'
import { parseArray, parseJson, type BusinessHoursRow, type ScopeRow, type SocialLink, type SpecificationRow } from '../lib/json.js'

/**
 * Database row -> API response mapping.
 *
 * This is the single boundary where internal fields are dropped. Public
 * serializers must never emit: status, draft content, internal moderation
 * reasons, submitter IP hashes, editor attribution, unconfirmed offerings,
 * or any field gated behind a disclosure toggle that is switched off.
 *
 * The public product/category shapes intentionally mirror the frontend's
 * existing domain types, so the client keeps using the same selectors.
 */

/** Media is served through a controlled route, never a static upload path. */
export function mediaUrl(mediaId: string | null | undefined): string | null {
  return mediaId ? `/api/media/${mediaId}` : null
}

/* ------------------------------------------------------------ Catalogue */

const productInclude = {
  applications: { include: { application: true } },
  requirementTags: { include: { requirementTag: true } },
  relatedFrom: { orderBy: { displayOrder: 'asc' } },
  images: { orderBy: { displayOrder: 'asc' }, include: { media: true } },
  documents: { orderBy: { displayOrder: 'asc' }, include: { media: true } },
} satisfies Prisma.ProductInclude

export const PRODUCT_INCLUDE = productInclude

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function publicProduct(product: any) {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    seoName: product.seoName ?? undefined,
    slug: product.slug,
    sku: product.sku ?? undefined,
    summary: product.summary,
    description: product.description,
    image: mediaUrl(product.mainImageId),
    gallery: (product.images ?? []).map((image: any) => mediaUrl(image.mediaId)).filter(Boolean),
    documents: (product.documents ?? []).map((doc: any) => ({
      title: doc.title,
      url: mediaUrl(doc.mediaId),
    })),
    visual: product.visual,
    specifications: parseArray<SpecificationRow>(product.specifications),
    useCases: parseArray<string>(product.useCases),
    applications: (product.applications ?? []).map((row: any) => row.application.slug),
    requirementTags: (product.requirementTags ?? []).map((row: any) => row.requirementTag.slug),
    relatedProducts: (product.relatedFrom ?? []).map((row: any) => row.relatedId),
    featured: product.featured,
    displayOrder: product.displayOrder,
    isActive: product.status === 'PUBLISHED',
  }
}

/** Admin view: everything the editor needs, including lifecycle fields. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adminProduct(product: any) {
  return {
    ...publicProduct(product),
    status: product.status,
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
    mainImageId: product.mainImageId ?? null,
    ogImageId: product.ogImageId ?? null,
    images: (product.images ?? []).map((image: any) => ({
      id: image.id,
      mediaId: image.mediaId,
      url: mediaUrl(image.mediaId),
      alt: image.alt,
      caption: image.caption ?? '',
      displayOrder: image.displayOrder,
    })),
    publishedAt: product.publishedAt,
    archivedAt: product.archivedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    createdBy: product.createdBy
      ? { id: product.createdBy.id, name: product.createdBy.name }
      : null,
    updatedBy: product.updatedBy
      ? { id: product.updatedBy.id, name: product.updatedBy.name }
      : null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function publicCategory(category: any) {
  return {
    id: category.id,
    divisionId: category.divisionId,
    name: category.name,
    shortName: category.shortName ?? undefined,
    slug: category.slug,
    summary: category.summary,
    description: category.description,
    image: mediaUrl(category.imageId),
    visual: category.visual,
    displayOrder: category.displayOrder,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adminCategory(category: any) {
  return {
    ...publicCategory(category),
    status: category.status,
    imageId: category.imageId ?? null,
    seoTitle: category.seoTitle ?? '',
    seoDescription: category.seoDescription ?? '',
    productCount: category._count?.products,
    publishedAt: category.publishedAt,
    updatedAt: category.updatedAt,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function publicService(service: any) {
  return {
    id: service.id,
    divisionId: 'div-services',
    name: service.name,
    slug: service.slug,
    summary: service.summary,
    description: service.description,
    image: mediaUrl(service.imageId),
    visual: service.visual,
    scope: parseArray<ScopeRow>(service.scope),
    applications: (service.applications ?? []).map((row: any) => row.application.slug),
    requirementTags: (service.requirementTags ?? []).map((row: any) => row.requirementTag.slug),
    isActive: service.status === 'PUBLISHED',
  }
}

/* ------------------------------------------------------------- Projects */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function publicProject(project: any) {
  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    summary: project.summary,
    description: project.description,
    projectType: project.projectType ?? null,
    location: project.location ?? null,
    // A client is named publicly only with explicit permission.
    client: project.clientPublishable ? (project.clientName ?? null) : null,
    year: project.completedYear ?? null,
    scope: project.scope ?? null,
    quantitySupplied: project.quantitySupplied ?? null,
    // A testimonial requires recorded consent before it can be shown.
    testimonial:
      project.testimonialConsent && project.testimonialQuote
        ? { quote: project.testimonialQuote, author: project.testimonialAuthor ?? null }
        : null,
    image: mediaUrl(project.coverImageId),
    visual: project.visual,
    gallery: (project.images ?? []).map((image: any) => ({
      url: mediaUrl(image.mediaId),
      alt: image.alt,
      caption: image.caption ?? null,
    })),
    products: (project.products ?? []).map((row: any) => row.productId),
    featured: project.featured,
    displayOrder: project.displayOrder,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adminProject(project: any) {
  return {
    ...publicProject(project),
    // Admins see the unredacted values plus the consent flags that gate them.
    clientName: project.clientName ?? '',
    clientPublishable: project.clientPublishable,
    testimonialQuote: project.testimonialQuote ?? '',
    testimonialAuthor: project.testimonialAuthor ?? '',
    testimonialConsent: project.testimonialConsent,
    coverImageId: project.coverImageId ?? null,
    status: project.status,
    seoTitle: project.seoTitle ?? '',
    seoDescription: project.seoDescription ?? '',
    images: (project.images ?? []).map((image: any) => ({
      id: image.id,
      mediaId: image.mediaId,
      url: mediaUrl(image.mediaId),
      alt: image.alt,
      caption: image.caption ?? '',
      displayOrder: image.displayOrder,
    })),
    publishedAt: project.publishedAt,
    archivedAt: project.archivedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    updatedBy: project.updatedBy ? { id: project.updatedBy.id, name: project.updatedBy.name } : null,
  }
}

/* -------------------------------------------------------------- Reviews */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function publicReview(review: any) {
  return {
    id: review.id,
    productId: review.productId,
    displayName: review.displayName,
    rating: review.rating,
    title: review.title ?? null,
    body: review.body,
    companyName: review.companyName ?? null,
    useContext: review.useContext ?? null,
    submittedAt: review.submittedAt,
    // Never exposed: status, internalReason, submitterIpHash, reference.
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adminReview(review: any) {
  return {
    id: review.id,
    productId: review.productId,
    productName: review.product?.name ?? null,
    displayName: review.displayName,
    rating: review.rating,
    title: review.title ?? null,
    body: review.body,
    companyName: review.companyName ?? null,
    useContext: review.useContext ?? null,
    reference: review.reference ?? null,
    status: review.status,
    internalReason: review.internalReason ?? null,
    submittedAt: review.submittedAt,
    editedAt: review.editedAt,
    publishedAt: review.publishedAt,
    openReports: review._count?.reports ?? undefined,
    events: (review.events ?? []).map((event: any) => ({
      action: event.action,
      reason: event.reason ?? null,
      at: event.createdAt,
      actor: event.actor ? { id: event.actor.id, name: event.actor.name } : null,
    })),
  }
}

/* ------------------------------------------------------- Company profile */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function publicCompany(profile: any) {
  return {
    companyName: profile.companyName,
    alternateName: profile.alternateName ?? '',
    // Gated: third-party sourced details stay hidden until confirmed.
    proprietor: profile.showProprietor ? (profile.proprietor ?? '') : '',
    establishedYear: profile.establishedYear ?? null,
    businessStructure: profile.businessStructure ?? '',
    natureOfBusiness: parseArray<string>(profile.natureOfBusiness),
    gstin: profile.showGstin ? (profile.gstin ?? '') : '',
    phone: profile.phone ?? '',
    whatsapp: profile.whatsapp ?? '',
    email: profile.email ?? '',
    address: {
      label: profile.addressLabel,
      lines: parseArray<string>(profile.addressLines),
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
      country: profile.country,
      isPublished: true,
    },
    warehouseAddress: {
      label: profile.warehouseLabel,
      lines: profile.showWarehouseAddress ? parseArray<string>(profile.warehouseLines) : [],
      city: profile.showWarehouseAddress ? profile.warehouseCity : '',
      state: profile.showWarehouseAddress ? profile.warehouseState : '',
      postalCode: profile.showWarehouseAddress ? profile.warehousePostalCode : '',
      country: 'India',
      isPublished: profile.showWarehouseAddress,
    },
    businessHours: parseArray<BusinessHoursRow>(profile.businessHours),
    mapsUrl: profile.mapsUrl ?? '',
    socialLinks: parseArray<SocialLink>(profile.socialLinks),
    siteUrl: profile.siteUrl ?? '',
    disclosure: {
      showProprietor: profile.showProprietor,
      showGstin: profile.showGstin,
      showTurnover: false,
      showEmployeeCount: false,
      showWarehouseAddress: profile.showWarehouseAddress,
    },
  }
}

/** Admin view returns the raw stored values regardless of the toggles. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adminCompany(profile: any) {
  return {
    ...publicCompany(profile),
    proprietor: profile.proprietor ?? '',
    gstin: profile.gstin ?? '',
    warehouseAddress: {
      label: profile.warehouseLabel,
      lines: parseArray<string>(profile.warehouseLines),
      city: profile.warehouseCity,
      state: profile.warehouseState,
      postalCode: profile.warehousePostalCode,
      country: 'India',
      isPublished: profile.showWarehouseAddress,
    },
    updatedAt: profile.updatedAt,
  }
}

/* ---------------------------------------------------------- Page content */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function publicPage(page: any) {
  return {
    key: page.key,
    title: page.title,
    seoTitle: page.seoTitle ?? '',
    seoDescription: page.seoDescription ?? '',
    sections: (page.sections ?? [])
      .filter((section: any) => section.enabled)
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
      .map((section: any) => ({
        id: section.id,
        type: section.type,
        data: parseJson<Record<string, unknown>>(section.data, {}),
      })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adminPage(page: any) {
  return {
    id: page.id,
    key: page.key,
    title: page.title,
    status: page.status,
    seoTitle: page.seoTitle ?? '',
    seoDescription: page.seoDescription ?? '',
    updatedAt: page.updatedAt,
    sections: (page.sections ?? [])
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
      .map((section: any) => ({
        id: section.id,
        type: section.type,
        enabled: section.enabled,
        displayOrder: section.displayOrder,
        data: parseJson<Record<string, unknown>>(section.data, {}),
      })),
  }
}
