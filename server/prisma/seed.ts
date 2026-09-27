import { prisma } from '../src/db.js'
import { categories, products, services } from '../../src/data/catalogue'
import { applications, requirementTags } from '../../src/data/taxonomy'
import { additionalOfferings, companyConfig } from '../../src/data/company'

/**
 * Seeds the confirmed catalogue.
 *
 * The frontend's static data files are imported directly so there is one
 * source of truth for the initial content: the same modules also act as the
 * offline fallback if the API is unreachable.
 *
 * Deliberately NOT seeded, because none of it was supplied and inventing it
 * would misrepresent the business:
 *   - projects, reviews, ratings, testimonials
 *   - phone, WhatsApp, email
 *   - prices, stock, specifications, certifications
 *   - enquiries or any activity data
 *
 * Third-party-reported offerings are inserted as CONFIRMATION_REQUIRED, so
 * they are visible to an admin but never to the public.
 *
 * Idempotent: every write is an upsert keyed on slug, so re-running only
 * tops up what is missing and never duplicates or overwrites edited content.
 */

const DIVISIONS = [
  { id: 'div-products', name: 'Products', slug: 'products', displayOrder: 0 },
  { id: 'div-services', name: 'Services', slug: 'services', displayOrder: 1 },
]

async function main() {
  console.log('Seeding…')

  for (const division of DIVISIONS) {
    await prisma.division.upsert({
      where: { slug: division.slug },
      update: { name: division.name, displayOrder: division.displayOrder },
      create: division,
    })
  }

  for (const [index, application] of applications.entries()) {
    await prisma.application.upsert({
      where: { slug: application.slug },
      update: {
        name: application.name,
        description: application.description,
        icon: application.icon,
        displayOrder: index,
      },
      create: {
        name: application.name,
        slug: application.slug,
        description: application.description,
        icon: application.icon,
        displayOrder: index,
      },
    })
  }

  for (const [index, tag] of requirementTags.entries()) {
    await prisma.requirementTag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name, hint: tag.hint, icon: tag.icon, displayOrder: index },
      create: {
        name: tag.name,
        slug: tag.slug,
        hint: tag.hint,
        icon: tag.icon,
        displayOrder: index,
      },
    })
  }

  const divisionBySlug = Object.fromEntries(
    (await prisma.division.findMany()).map((row) => [row.slug, row.id]),
  )

  const categoryIdBySeedId: Record<string, string> = {}
  for (const [index, category] of categories.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        shortName: category.shortName ?? null,
        summary: category.summary,
        description: category.description,
        visual: category.visual,
        displayOrder: index,
      },
      create: {
        divisionId: divisionBySlug.products,
        name: category.name,
        shortName: category.shortName ?? null,
        slug: category.slug,
        summary: category.summary,
        description: category.description,
        visual: category.visual,
        displayOrder: index,
        // The confirmed catalogue goes live immediately — it is the content
        // the current site already shows.
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })
    categoryIdBySeedId[category.id] = row.id
  }

  const productIdBySeedId: Record<string, string> = {}
  for (const [index, product] of products.entries()) {
    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        seoName: product.seoName ?? null,
        summary: product.summary,
        description: product.description,
        visual: product.visual,
        specifications: JSON.stringify(product.specifications),
        useCases: JSON.stringify(product.useCases),
        displayOrder: index,
      },
      create: {
        categoryId: categoryIdBySeedId[product.categoryId],
        name: product.name,
        seoName: product.seoName ?? null,
        slug: product.slug,
        summary: product.summary,
        description: product.description,
        visual: product.visual,
        // Empty — no specifications were supplied for any product.
        specifications: JSON.stringify(product.specifications),
        useCases: JSON.stringify(product.useCases),
        displayOrder: index,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })
    productIdBySeedId[product.id] = row.id
  }

  // Tag links, rebuilt from the seed definitions.
  const applicationIdBySlug = Object.fromEntries(
    (await prisma.application.findMany()).map((row) => [row.slug, row.id]),
  )
  const tagIdBySlug = Object.fromEntries(
    (await prisma.requirementTag.findMany()).map((row) => [row.slug, row.id]),
  )

  for (const product of products) {
    const productId = productIdBySeedId[product.id]

    for (const slug of product.applications) {
      const applicationId = applicationIdBySlug[slug]
      if (!applicationId) continue
      await prisma.productApplication.upsert({
        where: { productId_applicationId: { productId, applicationId } },
        update: {},
        create: { productId, applicationId },
      })
    }

    for (const slug of product.requirementTags) {
      const requirementTagId = tagIdBySlug[slug]
      if (!requirementTagId) continue
      await prisma.productRequirementTag.upsert({
        where: { productId_requirementTagId: { productId, requirementTagId } },
        update: {},
        create: { productId, requirementTagId },
      })
    }

    for (const [order, relatedSeedId] of product.relatedProducts.entries()) {
      const relatedId = productIdBySeedId[relatedSeedId]
      if (!relatedId || relatedId === productId) continue
      await prisma.relatedProduct.upsert({
        where: { productId_relatedId: { productId, relatedId } },
        update: { displayOrder: order },
        create: { productId, relatedId, displayOrder: order },
      })
    }
  }

  for (const [index, service] of services.entries()) {
    const row = await prisma.service.upsert({
      where: { slug: service.slug },
      update: {
        name: service.name,
        summary: service.summary,
        description: service.description,
        visual: service.visual,
        scope: JSON.stringify(service.scope),
        displayOrder: index,
      },
      create: {
        name: service.name,
        slug: service.slug,
        summary: service.summary,
        description: service.description,
        visual: service.visual,
        scope: JSON.stringify(service.scope),
        displayOrder: index,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    for (const slug of service.applications) {
      const applicationId = applicationIdBySlug[slug]
      if (!applicationId) continue
      await prisma.serviceApplication.upsert({
        where: { serviceId_applicationId: { serviceId: row.id, applicationId } },
        update: {},
        create: { serviceId: row.id, applicationId },
      })
    }
    for (const slug of service.requirementTags) {
      const requirementTagId = tagIdBySlug[slug]
      if (!requirementTagId) continue
      await prisma.serviceRequirementTag.upsert({
        where: { serviceId_requirementTagId: { serviceId: row.id, requirementTagId } },
        update: {},
        create: { serviceId: row.id, requirementTagId },
      })
    }
  }

  // Company profile. Phone/WhatsApp/email stay empty until the owner
  // supplies them; the public site hides those actions rather than guessing.
  await prisma.companyProfile.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      companyName: companyConfig.companyName,
      alternateName: companyConfig.alternateName,
      proprietor: companyConfig.proprietor,
      establishedYear: companyConfig.establishedYear,
      businessStructure: companyConfig.businessStructure,
      natureOfBusiness: JSON.stringify(companyConfig.natureOfBusiness),
      gstin: companyConfig.gstin,
      phone: '',
      whatsapp: '',
      email: '',
      addressLabel: companyConfig.address.label,
      addressLines: JSON.stringify(companyConfig.address.lines),
      city: companyConfig.address.city,
      state: companyConfig.address.state,
      postalCode: companyConfig.address.postalCode,
      country: companyConfig.address.country,
      warehouseLabel: companyConfig.warehouseAddress.label,
      warehouseLines: JSON.stringify(companyConfig.warehouseAddress.lines),
      warehouseCity: companyConfig.warehouseAddress.city,
      warehouseState: companyConfig.warehouseAddress.state,
      warehousePostalCode: companyConfig.warehouseAddress.postalCode,
      businessHours: JSON.stringify(companyConfig.businessHours),
      socialLinks: JSON.stringify([]),
      siteUrl: companyConfig.siteUrl,
      // Third-party sourced details stay hidden until confirmed in the admin.
      showProprietor: false,
      showGstin: false,
      showWarehouseAddress: false,
    },
  })

  for (const [index, offering] of additionalOfferings.entries()) {
    const existing = await prisma.additionalOffering.findFirst({ where: { name: offering.name } })
    if (existing) continue
    await prisma.additionalOffering.create({
      data: {
        name: offering.name,
        type: offering.type,
        status: 'CONFIRMATION_REQUIRED',
        source: offering.source,
        note: offering.note,
        displayOrder: index,
      },
    })
  }

  await seedPages()

  console.log(
    `Seeded: ${categories.length} categories, ${products.length} products, ${services.length} service(s).`,
  )
  console.log('No projects, reviews, enquiries or contact details were seeded — by design.')
}

/** Home and About start from the copy the current site already ships. */
async function seedPages() {
  const home = await prisma.contentPage.findUnique({ where: { key: 'home' } })
  if (!home) {
    await prisma.contentPage.create({
      data: {
        key: 'home',
        title: 'Home',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        seoTitle:
          'Veer Hanuman Trading Co. | Construction & Infrastructure Products in Hyderabad',
        seoDescription:
          'Veer Hanuman Trading Co. supplies RCC, FRP, drainage and piping products for construction, infrastructure and project requirements in Hyderabad and Telangana.',
        sections: {
          create: [
            {
              type: 'hero',
              displayOrder: 0,
              data: JSON.stringify({
                eyebrow: 'Infrastructure supply · Drainage · Landscaping',
                title: 'Reliable infrastructure products.',
                titleAccent: 'Built for every project.',
                description:
                  'RCC, FRP, drainage and piping solutions for construction, infrastructure and landscaping projects across Hyderabad and Telangana.',
                primaryCtaLabel: 'Explore products',
                primaryCtaHref: '/products',
                secondaryCtaLabel: 'Get a Quote',
                secondaryCtaHref: '/request-quote',
              }),
            },
            {
              type: 'categories',
              displayOrder: 1,
              data: JSON.stringify({
                eyebrow: 'Product catalogue',
                title: 'Products for infrastructure & construction',
                intro:
                  'Navigate the catalogue by product family, then send your requirement for availability and quotation.',
              }),
            },
            {
              type: 'requirementFinder',
              displayOrder: 2,
              data: JSON.stringify({
                eyebrow: 'Requirement finder',
                title: 'What are you looking for?',
                intro: 'Start with the application if you do not know the exact product name.',
              }),
            },
            {
              type: 'applications',
              displayOrder: 3,
              data: JSON.stringify({
                eyebrow: 'Applications',
                title: 'Where these products are used',
                intro:
                  'The same product often serves several project types. Pick the closest application to see what we can supply for it.',
              }),
            },
            {
              type: 'whyUs',
              displayOrder: 4,
              data: JSON.stringify({
                eyebrow: 'Why Veer Hanuman',
                title: 'Built around your project requirements',
                intro:
                  'From individual material requirements to larger project quantities, we help customers source the products they need through a direct and practical enquiry process.',
              }),
            },
            {
              type: 'featuredProducts',
              displayOrder: 5,
              data: JSON.stringify({
                eyebrow: 'From the catalogue',
                title: 'Frequently requested products',
                intro:
                  'A selection across the three product families. Open any product for applications and enquiry options.',
              }),
            },
            {
              type: 'landscaping',
              displayOrder: 6,
              data: JSON.stringify({
                eyebrow: 'Services',
                title: 'Landscaping for project and campus sites',
              }),
            },
            {
              type: 'projects',
              displayOrder: 7,
              data: JSON.stringify({
                eyebrow: 'Products in application',
                title: 'Where our products end up',
              }),
            },
            {
              type: 'quoteCta',
              displayOrder: 8,
              data: JSON.stringify({
                eyebrow: 'Request a quotation',
                title: 'Send your requirement and we will come back with a quotation',
                description:
                  'Share the product, quantity, size or specification and delivery location. For BOQ-based requirements, include the relevant line items and we will review them together.',
              }),
            },
          ],
        },
      },
    })
  }

  const about = await prisma.contentPage.findUnique({ where: { key: 'about' } })
  if (!about) {
    await prisma.contentPage.create({
      data: {
        key: 'about',
        title: 'About Us',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        seoTitle: 'About Us',
        seoDescription:
          'Veer Hanuman Trading Co. is a Hyderabad-based wholesaler, retailer, manufacturer and contractor supplying RCC, FRP and piping products for construction and infrastructure projects.',
        sections: {
          create: [
            {
              type: 'intro',
              displayOrder: 0,
              data: JSON.stringify({
                eyebrow: 'About us',
                title: 'Veer Hanuman Trading Co.',
                body: 'A Hyderabad-based supplier and contractor for construction, civil infrastructure and landscaping requirements.',
              }),
            },
            {
              type: 'overview',
              displayOrder: 1,
              data: JSON.stringify({
                title: 'What we do',
                body: 'Veer Hanuman Trading Co. supplies materials and products used in construction and civil infrastructure work. The catalogue covers precast RCC items such as chambers, manhole covers, poles and tree guards; FRP frame and cover assemblies; and piping for drainage and utility routing.',
              }),
            },
            {
              type: 'capabilities',
              displayOrder: 2,
              data: JSON.stringify({
                title: 'How we work',
                body: 'Requirements reach us in very different shapes — a single material requirement for a site already under way, a repeat requirement across a layout, or project quantities for a larger programme of work. Quotations are prepared against the sizes, quantities and delivery details you share rather than against a fixed price list.',
              }),
            },
            {
              type: 'customers',
              displayOrder: 3,
              data: JSON.stringify({
                title: 'Who we work with',
                items: [
                  'Civil and infrastructure contractors',
                  'Builders and real-estate developers',
                  'Drainage and sewerage contractors',
                  'Industrial and plant projects',
                  'Landscaping contractors',
                  'Architects and consultants',
                  'Procurement teams',
                  'Commercial construction projects',
                ],
              }),
            },
            {
              type: 'businessDetails',
              displayOrder: 4,
              data: JSON.stringify({ title: 'Business details' }),
            },
          ],
        },
      },
    })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
