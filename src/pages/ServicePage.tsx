import { Check } from 'lucide-react'
import { useParams } from 'react-router-dom'
import NotFound from './NotFound'
import { ProductCard } from '../components/catalogue/ProductCard'
import { QuoteCta } from '../components/home/QuoteCta'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Section, SectionHeading } from '../components/ui/Section'
import { TagList } from '../components/ui/Tag'
import { WhatsAppButton } from '../components/ui/WhatsAppButton'
import { Visual } from '../components/visuals/ProductVisual'
import {
  getProductsByRequirementTag,
  getServiceBySlug,
  resolveApplications,
  resolveRequirementTags,
} from '../data'
import { serviceEnquiryMessage } from '../lib/contact'
import { applicationUrl, finderUrl, paths, quoteUrlFor, serviceUrl } from '../lib/paths'
import { breadcrumbSchema, serviceSchema } from '../lib/schema'
import { Seo } from '../lib/seo'

/**
 * Service detail page. Greener treatment than the product pages while
 * keeping the same type, spacing and card language, so landscaping reads
 * as part of Veer Hanuman rather than a separate business.
 */
export default function ServicePage() {
  const { serviceSlug } = useParams<{ serviceSlug: string }>()
  const service = getServiceBySlug(serviceSlug)

  // Unpublished or archived services are absent from published content.
  if (!service) return <NotFound />

  const path = serviceUrl(service)
  const applications = resolveApplications(service.applications)
  const requirements = resolveRequirementTags(service.requirementTags)
  const message = serviceEnquiryMessage(service.name)

  // Products commonly supplied alongside this service, resolved from tags.
  const relatedProducts = service.requirementTags
    .flatMap((tag) => getProductsByRequirementTag(tag))
    .filter((product, index, all) => all.findIndex((p) => p.id === product.id) === index)
    .slice(0, 3)

  return (
    <>
      <Seo
        title={service.name}
        description={`${service.summary} Discuss scope and requirements with Veer Hanuman Trading Co., Hyderabad.`}
        path={path}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: paths.home },
            { name: 'Services', path: paths.services },
            { name: service.name, path },
          ]),
          serviceSchema(service, path),
        ]}
      />

      <PageHeader
        crumbs={[
          { name: 'Home', path: paths.home },
          { name: 'Services', path: paths.services },
          { name: service.name },
        ]}
        eyebrow="Service"
        title={`${service.name} for project & campus sites`}
        intro={service.description}
        actions={
          <>
            <Button to={quoteUrlFor(service.name)} variant="accent" size="lg">
              Discuss your requirement
            </Button>
            <WhatsAppButton message={message} size="lg" tone="onDark" />
          </>
        }
        aside={
          <div className="overflow-hidden border border-cream/15">
            <div className="aspect-[4/3] w-full">
              <Visual
                variant={service.visual}
                image={service.image}
                alt={`${service.name} work`}
                tone="dark"
                loading="eager"
              />
            </div>
          </div>
        }
      />

      <Section tone="moss">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="text-[22px] sm:text-[26px]">Scope of work</h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-charcoal-600">
              Scope is agreed for each site. The areas below are what we take up — where your
              requirement extends beyond them, describe it in your enquiry and we will confirm what
              is practical.
            </p>
            <ul className="mt-7 divide-y divide-moss/15 border-y border-moss/15">
              {service.scope.map((item) => (
                <li key={item.title} className="flex items-start gap-3.5 py-4">
                  <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-moss" />
                  <div>
                    <h3 className="text-base">{item.title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-charcoal-600">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-moss/20 bg-cream-100 p-6">
              <h2 className="text-lg">Enquire about {service.name.toLowerCase()}</h2>
              <p className="mt-2 text-sm leading-relaxed text-concrete-700">
                Share the site location, the area involved and the stage the site is at. We will
                come back on scope and quotation.
              </p>
              <div className="mt-5 space-y-2.5">
                <Button to={quoteUrlFor(service.name)} variant="primary" size="lg" block>
                  Discuss your requirement
                </Button>
                <WhatsAppButton message={message} size="lg" block />
              </div>
              <div className="mt-6 space-y-6 border-t border-moss/15 pt-5">
                <TagList
                  label="Applications"
                  items={applications}
                  tone="moss"
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

      {relatedProducts.length > 0 && (
        <Section tone="cream" divided>
          <SectionHeading
            eyebrow="Related products"
            title="Products supplied alongside this work"
            intro="Catalogue items that commonly form part of the same requirement."
          />
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {relatedProducts.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} className="w-full" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <QuoteCta />
    </>
  )
}
