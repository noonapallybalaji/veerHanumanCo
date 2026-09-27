import { Check, Info } from 'lucide-react'
import { Navigate, useParams } from 'react-router-dom'
import { ProductCard } from '../components/catalogue/ProductCard'
import { ProductReviews } from '../components/reviews/ProductReviews'
import { QuoteCta } from '../components/home/QuoteCta'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Section, SectionHeading } from '../components/ui/Section'
import { TagList } from '../components/ui/Tag'
import { WhatsAppButton } from '../components/ui/WhatsAppButton'
import { Visual } from '../components/visuals/ProductVisual'
import {
  getCategoryBySlug,
  getCategoryForProduct,
  getProductBySlug,
  getRelatedProducts,
  productDisplayName,
  resolveApplications,
  resolveRequirementTags,
} from '../data'
import { getRating } from '../content/store'
import { productEnquiryMessage } from '../lib/contact'
import { applicationUrl, categoryUrl, finderUrl, paths, productUrl, quoteUrlFor } from '../lib/paths'
import { breadcrumbSchema, productSchema } from '../lib/schema'
import { Seo } from '../lib/seo'
import NotFound from './NotFound'

export default function ProductPage() {
  const { categorySlug, productSlug } = useParams<{
    categorySlug: string
    productSlug: string
  }>()

  const product = getProductBySlug(productSlug)
  const categoryFromUrl = getCategoryBySlug(categorySlug)

  /*
   * A product that is unpublished or archived in the CMS is simply absent
   * from the published content, so it lands here. Render the not-found page
   * rather than redirecting: the URL stays put, the page is marked noindex,
   * and nothing about the draft is disclosed.
   */
  if (!product) return <NotFound />

  const category = getCategoryForProduct(product)
  if (!category) return <NotFound />

  // Canonicalise: a product reached under the wrong family redirects to its
  // real place in the hierarchy instead of rendering a duplicate URL.
  if (categoryFromUrl?.id !== category.id) {
    return <Navigate to={productUrl(product)} replace />
  }

  const name = productDisplayName(product)
  const path = productUrl(product)
  const applications = resolveApplications(product.applications)
  const requirements = resolveRequirementTags(product.requirementTags)
  const related = getRelatedProducts(product)
  const whatsAppMessage = productEnquiryMessage(name, category.name)
  const gallery = product.gallery.filter(Boolean)

  return (
    <>
      <Seo
        title={name}
        description={`${product.summary} Request availability, specifications and a quotation from Veer Hanuman Trading Co., Hyderabad.`}
        path={path}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: paths.home },
            { name: 'Products', path: paths.products },
            { name: category.name, path: categoryUrl(category) },
            { name: name, path },
          ]),
          // Only carries an aggregateRating when approved reviews exist.
          productSchema(product, category, path, getRating(product.id)),
        ]}
      />

      <PageHeader
        crumbs={[
          { name: 'Home', path: paths.home },
          { name: 'Products', path: paths.products },
          { name: category.name, path: categoryUrl(category) },
          { name: product.name },
        ]}
        eyebrow={category.name}
        title={name}
        intro={product.summary}
        actions={
          <>
            <Button to={quoteUrlFor(name)} variant="accent" size="lg">
              Request a quotation
            </Button>
            <WhatsAppButton
              message={whatsAppMessage}
              size="lg"
              tone="onDark"
              label="WhatsApp enquiry"
            />
          </>
        }
        aside={
          <div className="overflow-hidden border border-cream/15">
            <div className="aspect-[4/3] w-full">
              <Visual
                variant={product.visual}
                image={product.image}
                alt={name}
                tone="dark"
                loading="eager"
              />
            </div>
          </div>
        }
      />

      <Section tone="cream">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          {/* Description, use cases, specifications */}
          <div>
            <h2 className="text-[22px] sm:text-[26px]">About {name}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-charcoal-600">
              {product.description}
            </p>

            {product.useCases.length > 0 && (
              <>
                <h3 className="mt-9 text-lg">Typical use cases</h3>
                <ul className="mt-4 space-y-2.5">
                  {product.useCases.map((useCase) => (
                    <li key={useCase} className="flex items-start gap-2.5 text-[15px] text-charcoal-600">
                      <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-terracotta" />
                      {useCase}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3 className="mt-9 text-lg">Specifications</h3>
            {product.specifications.length > 0 ? (
              <dl className="mt-4 divide-y divide-concrete-200 border-y border-concrete-200">
                {product.specifications.map((spec) => (
                  <div key={spec.label} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr]">
                    <dt className="text-[13px] font-semibold uppercase tracking-[0.08em] text-concrete">
                      {spec.label}
                    </dt>
                    <dd className="text-[15px] text-charcoal">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              /* No dimensions, load ratings, grades or standards were
                 supplied for this product, so none are stated. */
              <p className="mt-4 flex items-start gap-2.5 border border-concrete-200 bg-cream-100 p-4 text-[14px] leading-relaxed text-concrete-700">
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-concrete" />
                <span>
                  Specifications available on request. Share the sizes and quantities your project
                  needs and we will confirm what can be supplied against them.
                </span>
              </p>
            )}

            {gallery.length > 0 && (
              <>
                <h3 className="mt-9 text-lg">Gallery</h3>
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {gallery.map((src, index) => (
                    <li key={src} className="aspect-[4/3] overflow-hidden border border-concrete-200">
                      <img
                        src={src}
                        alt={`${name} — image ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Enquiry rail */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-concrete-200 bg-cream-100 p-6">
              <h2 className="text-lg">Enquire about {product.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-concrete-700">
                Send your requirement with quantity, size or specification and delivery location.
                Quotations are prepared against what you share.
              </p>
              <div className="mt-5 space-y-2.5">
                <Button to={quoteUrlFor(name)} variant="primary" size="lg" block>
                  Request a quotation
                </Button>
                <WhatsAppButton message={whatsAppMessage} size="lg" block label="WhatsApp enquiry" />
              </div>

              <dl className="mt-6 space-y-4 border-t border-concrete-200 pt-5 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                    Product family
                  </dt>
                  <dd className="mt-1">
                    <Button to={categoryUrl(category)} variant="ghost" size="sm" className="-ml-3.5">
                      {category.name}
                    </Button>
                  </dd>
                </div>
              </dl>

              <div className="mt-2 space-y-6 border-t border-concrete-200 pt-5">
                <TagList
                  label="Applications"
                  items={applications}
                  hrefFor={(slug) => applicationUrl(slug)}
                />
                <TagList
                  label="Requirement tags"
                  items={requirements}
                  tone="accent"
                  hrefFor={(slug) => finderUrl(slug)}
                />
              </div>
            </div>
          </aside>
        </div>
      </Section>

      <ProductReviews productSlug={product.slug} productName={product.name} />

      {related.length > 0 && (
        <Section tone="concrete" divided>
          <SectionHeading
            eyebrow="Related products"
            title="Often requested together"
            intro="Other products from the catalogue that commonly appear on the same requirement."
          />
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.id} className="flex">
                <ProductCard product={item} className="w-full" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <QuoteCta />
    </>
  )
}
