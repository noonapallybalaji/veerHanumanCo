import { ArrowRight, SlidersHorizontal, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdditionalOfferings } from '../components/catalogue/AdditionalOfferings'
import { CategoryCard } from '../components/catalogue/CategoryCard'
import { MatchGrid } from '../components/catalogue/MatchGrid'
import { ProductCard } from '../components/catalogue/ProductCard'
import { ServiceCard } from '../components/catalogue/ServiceCard'
import { ApplicationFilter } from '../components/discovery/ApplicationFilter'
import { RequirementFinder } from '../components/discovery/RequirementFinder'
import { QuoteCta } from '../components/home/QuoteCta'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Section, SectionHeading } from '../components/ui/Section'
import {
  activeServices,
  applicationBySlug,
  getMatchesByApplication,
  getMatchesByRequirementTag,
  getProductsByCategory,
  productCategories,
  productDisplayName,
  requirementTagBySlug,
} from '../data'
import { categoryUrl, paths } from '../lib/paths'
import { breadcrumbSchema, itemListSchema } from '../lib/schema'
import { Seo } from '../lib/seo'

/**
 * Full catalogue. Filters live in the URL (?requirement= / ?application=)
 * so a filtered view can be linked, shared and bookmarked — the homepage
 * finder and the application cards both deep-link into this page.
 */
export default function Products() {
  const [params, setParams] = useSearchParams()
  const requirement = params.get('requirement')
  const application = params.get('application')

  const requirementTag = requirement ? requirementTagBySlug.get(requirement) : undefined
  const applicationTag = application ? applicationBySlug.get(application) : undefined

  function setFilter(key: 'requirement' | 'application', value: string | null) {
    const next = new URLSearchParams(params)
    // Only one dimension at a time — combining them narrows a nine-product
    // catalogue to nothing useful and confuses the result count.
    next.delete('requirement')
    next.delete('application')
    if (value) next.set(key, value)
    setParams(next, { replace: true, preventScrollReset: true })
  }

  const isFiltered = Boolean(requirementTag ?? applicationTag)
  const matches = requirementTag
    ? getMatchesByRequirementTag(requirementTag.slug)
    : applicationTag
      ? getMatchesByApplication(applicationTag.slug)
      : []

  const activeFilterName = requirementTag?.name ?? applicationTag?.name

  const listItems = productCategories.flatMap((category) =>
    getProductsByCategory(category.id).map((product) => ({
      name: productDisplayName(product),
      path: `/products/${category.slug}/${product.slug}`,
    })),
  )

  return (
    <>
      <Seo
        title="Products — RCC, FRP Frame with Covers & Pipes"
        description="Browse the Veer Hanuman Trading Co. catalogue: RCC chambers, manhole covers, poles and tree guards, FRP frame with covers, and HDPE, EcoDrain and DWC pipes for projects in Hyderabad."
        path={paths.products}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: paths.home },
            { name: 'Products', path: paths.products },
          ]),
          itemListSchema('Veer Hanuman Trading Co. product catalogue', listItems),
        ]}
      />

      <PageHeader
        crumbs={[{ name: 'Home', path: paths.home }, { name: 'Products' }]}
        eyebrow="Catalogue"
        title="Products for infrastructure & construction"
        intro="Three product families covering precast RCC items, FRP frame and cover assemblies, and piping. Browse by family below, or filter by requirement and application."
        actions={
          <Button to={paths.requestQuote} variant="accent" size="lg">
            Request a quotation
          </Button>
        }
        aside={
          /* Jump straight to a family without scrolling the page. */
          <ul className="divide-y divide-cream/10 border border-cream/15">
            {productCategories.map((category) => {
              const count = getProductsByCategory(category.id).length
              return (
                <li key={category.id}>
                  <Link
                    to={categoryUrl(category)}
                    className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-cream/5"
                  >
                    <span>
                      <span className="block font-display text-sm font-extrabold uppercase tracking-[0.08em] text-cream">
                        {category.name}
                      </span>
                      <span className="mt-1 block text-[12.5px] text-cream/50">
                        {count} {count === 1 ? 'product' : 'products'}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-cream/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-cream"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        }
      />

      {/* Product families — the actual business hierarchy */}
      <Section tone="cream">
        <SectionHeading
          eyebrow="Product families"
          title="Browse by product family"
          intro="Each family opens to its own page with the products inside it."
        />
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {productCategories.map((category) => (
            <li key={category.id} className="flex">
              <CategoryCard category={category} className="w-full" />
            </li>
          ))}
        </ul>
      </Section>

      {/* Discovery filters */}
      <Section id="filter" tone="concrete" divided>
        <SectionHeading
          eyebrow="Requirement finder"
          title="Find products by requirement"
          intro="Select a requirement or an application. Results are driven by the tags on each product, so a product can appear under more than one without changing which family it belongs to."
        />

        <RequirementFinder
          value={requirement}
          onChange={(slug) => setFilter('requirement', slug)}
        />

        <div className="mt-8 border-t border-concrete-300 pt-6">
          <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-concrete">
            <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
            Filter by application
          </h3>
          <ApplicationFilter
            value={application}
            onChange={(slug) => setFilter('application', slug)}
          />
        </div>

        <div aria-live="polite" className="mt-10">
          {isFiltered ? (
            <div className="animate-fade-up">
              <div className="mb-6 flex flex-col gap-3 border-t border-concrete-300 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg">
                  {matches.length} {matches.length === 1 ? 'result' : 'results'} for{' '}
                  <span className="text-terracotta">{activeFilterName}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setFilter('requirement', null)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-sm border border-charcoal/20 px-3 text-sm font-semibold text-charcoal transition-colors hover:border-charcoal hover:bg-charcoal hover:text-cream"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                  Clear filter
                </button>
              </div>
              <MatchGrid
                matches={matches}
                emptyState={
                  <p className="border border-concrete-300 bg-cream-100 p-6 text-sm text-concrete-700">
                    No catalogue items are tagged for this requirement yet. Send your requirement
                    and we will confirm what can be arranged.
                  </p>
                }
              />
            </div>
          ) : (
            <p className="border-t border-concrete-300 pt-6 text-sm text-concrete-700">
              No filter applied — the complete catalogue is listed below.
            </p>
          )}
        </div>
      </Section>

      {/* Complete catalogue, grouped strictly by the business hierarchy */}
      {productCategories.map((category, index) => {
        const items = getProductsByCategory(category.id)
        if (items.length === 0) return null
        return (
          <Section key={category.id} tone="cream" divided={index === 0}>
            <SectionHeading
              eyebrow={`Product family ${index + 1} of ${productCategories.length}`}
              title={category.name}
              intro={category.summary}
              action={
                <Button to={categoryUrl(category)} variant="outline" size="sm">
                  Open {category.shortName ?? category.name} page
                </Button>
              }
            />
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((product) => (
                <li key={product.id} className="flex">
                  <ProductCard product={product} showCategory={false} className="w-full" />
                </li>
              ))}
            </ul>
          </Section>
        )
      })}

      {/* Services */}
      {activeServices.length > 0 && (
        <Section tone="moss" divided>
          <SectionHeading
            eyebrow="Services"
            title="Services alongside supply"
            intro="Confirmed service offering, available in addition to material supply."
          />
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activeServices.map((service) => (
              <li key={service.id} className="flex">
                <ServiceCard service={service} className="w-full" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <AdditionalOfferings />

      <QuoteCta />
    </>
  )
}
