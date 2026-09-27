import { AdditionalOfferings } from '../components/catalogue/AdditionalOfferings'
import { ServiceCard } from '../components/catalogue/ServiceCard'
import { QuoteCta } from '../components/home/QuoteCta'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Section, SectionHeading } from '../components/ui/Section'
import { ProductVisual } from '../components/visuals/ProductVisual'
import { activeServices } from '../data'
import { companyConfig } from '../data/company'
import { paths } from '../lib/paths'
import { breadcrumbSchema } from '../lib/schema'
import { Seo } from '../lib/seo'

/**
 * Services overview. Landscaping is the only confirmed service, so it is
 * the only one listed. Paver block fixing and tile fixing appear in
 * data/company.ts as unconfirmed additional offerings and stay hidden
 * until the owner confirms them.
 */
export default function Services() {
  return (
    <>
      <Seo
        title="Services — Landscaping & Project Support"
        description={`Services from ${companyConfig.companyName}, Hyderabad: landscape development, plantation, tree guards and outdoor area work alongside material supply for construction projects.`}
        path={paths.services}
        schema={breadcrumbSchema([
          { name: 'Home', path: paths.home },
          { name: 'Services', path: paths.services },
        ])}
      />

      <PageHeader
        crumbs={[{ name: 'Home', path: paths.home }, { name: 'Services' }]}
        eyebrow="Services"
        title="Services alongside material supply"
        intro="As well as supplying products, we take up landscaping work for project sites, campuses and developed premises. Scope is agreed against the site and the stage it has reached."
        actions={
          <Button to={paths.requestQuote} variant="accent" size="lg">
            Discuss your requirement
          </Button>
        }
        aside={
          <div className="overflow-hidden border border-cream/15">
            <div className="aspect-[4/3] w-full">
              <ProductVisual variant="landscaping" alt="" tone="dark" />
            </div>
          </div>
        }
      />

      <Section tone="cream">
        <SectionHeading
          eyebrow="Confirmed services"
          title="What we take up"
          intro="Open a service for its scope and enquiry options."
        />
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {activeServices.map((service) => (
            <li key={service.id} className="flex">
              <ServiceCard service={service} className="w-full" />
            </li>
          ))}
        </ul>

        <div className="mt-8 border border-concrete-200 bg-cream-100 p-6">
          <h3 className="text-lg">Working with supply on the same site</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-concrete-700">
            Landscaping work is often combined with supply of related products from the catalogue —
            RCC tree guards for plantation areas, and drainage piping for planted and paved
            surfaces. If your requirement covers both, send it as one enquiry and we will review it
            together.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button to={paths.products} variant="outline" size="md">
              Browse products
            </Button>
            <Button to={paths.requestQuote} variant="primary" size="md">
              Request a quotation
            </Button>
          </div>
        </div>
      </Section>

      <AdditionalOfferings type="service" />

      <QuoteCta />
    </>
  )
}
