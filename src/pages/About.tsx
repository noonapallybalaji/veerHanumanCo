import { Building, Calendar, MapPin, Users } from 'lucide-react'
import { QuoteCta } from '../components/home/QuoteCta'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Section } from '../components/ui/Section'
import { ProductVisual } from '../components/visuals/ProductVisual'
import { activeServices, productCategories, activeProducts } from '../data'
import { companyConfig } from '../data/company'
import { fullAddressLines } from '../lib/contact'
import { paths } from '../lib/paths'
import { breadcrumbSchema, organizationSchema } from '../lib/schema'
import { Seo } from '../lib/seo'

/**
 * About page.
 *
 * Every statement here maps to a supplied fact: year of establishment,
 * business structure, nature of business, location and the catalogue
 * itself. No company history, milestones, team size, turnover, awards or
 * certifications are stated, because none were confirmed.
 *
 * The proprietor's name and GSTIN came from third-party directories and
 * render only when the matching `disclosure` flag in data/company.ts is
 * switched on.
 */
export default function About() {
  const { disclosure } = companyConfig

  const facts = [
    { icon: Calendar, label: 'Established', value: String(companyConfig.establishedYear) },
    { icon: Building, label: 'Business structure', value: companyConfig.businessStructure },
    {
      icon: Users,
      label: 'Nature of business',
      value: companyConfig.natureOfBusiness.join(' · '),
    },
    {
      icon: MapPin,
      label: 'Based in',
      value: `${companyConfig.address.city}, ${companyConfig.address.state}`,
    },
  ]

  return (
    <>
      <Seo
        title="About Us"
        description={`${companyConfig.companyName} is a Hyderabad-based wholesaler, retailer, manufacturer and contractor established in ${companyConfig.establishedYear}, supplying RCC, FRP and piping products for construction and infrastructure projects.`}
        path={paths.about}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: paths.home },
            { name: 'About Us', path: paths.about },
          ]),
          organizationSchema(),
        ]}
      />

      <PageHeader
        crumbs={[{ name: 'Home', path: paths.home }, { name: 'About Us' }]}
        eyebrow="About us"
        title={companyConfig.companyName}
        intro={
          <>
            A {companyConfig.address.city}-based supplier and contractor for construction, civil
            infrastructure and landscaping requirements. Established in{' '}
            {companyConfig.establishedYear} and operating as a{' '}
            {companyConfig.businessStructure.toLowerCase()}, we work as a{' '}
            {companyConfig.natureOfBusiness.join(', ').toLowerCase()} across the product families in
            our catalogue.
          </>
        }
        actions={
          <>
            <Button to={paths.products} variant="accent" size="lg">
              Explore products
            </Button>
            <Button to={paths.contact} variant="onDark" size="lg">
              Contact us
            </Button>
          </>
        }
        aside={
          <div className="overflow-hidden border border-cream/15">
            <div className="aspect-[4/3] w-full">
              <ProductVisual variant="infrastructure" alt="" tone="dark" />
            </div>
          </div>
        }
      />

      {/* Company facts — supplied data only */}
      <Section tone="cream">
        <dl className="grid grid-cols-1 gap-px overflow-hidden border border-concrete-200 bg-concrete-200 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => {
            const Icon = fact.icon
            return (
              <div key={fact.label} className="bg-cream-100 p-5">
                <Icon aria-hidden="true" className="h-4 w-4 text-terracotta" />
                <dt className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                  {fact.label}
                </dt>
                <dd className="mt-1.5 text-[15px] font-semibold text-charcoal">{fact.value}</dd>
              </div>
            )
          })}
        </dl>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-[22px] sm:text-[26px]">What we do</h2>
            <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-charcoal-600">
              <p>
                {companyConfig.companyName} — also known as {companyConfig.alternateName} — supplies
                materials and products used in construction and civil infrastructure work. The
                catalogue covers {activeProducts.length} products across{' '}
                {productCategories.length} families: precast RCC items such as chambers, manhole
                covers, poles and tree guards; FRP frame and cover assemblies; and piping for
                drainage and utility routing.
              </p>
              <p>
                Requirements reach us in very different shapes — a single material requirement for a
                site already under way, a repeat requirement across a layout, or project quantities
                for a larger programme of work. Enquiries for bulk and project quantities are
                welcome alongside smaller individual requirements, and quotations are prepared
                against the sizes, quantities and delivery details you share rather than against a
                fixed price list.
              </p>
              <p>
                Alongside supply, we take up{' '}
                {activeServices.map((service) => service.name.toLowerCase()).join(' and ')} work for
                project sites, campuses and developed premises. This frequently sits with supply of
                related products from the catalogue, so a single enquiry can cover both.
              </p>
            </div>

            <h2 className="mt-10 text-[22px] sm:text-[26px]">Who we work with</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                'Civil and infrastructure contractors',
                'Builders and real-estate developers',
                'Drainage and sewerage contractors',
                'Industrial and plant projects',
                'Landscaping contractors',
                'Architects and consultants',
                'Procurement teams',
                'Commercial construction projects',
              ].map((customer) => (
                <li
                  key={customer}
                  className="flex items-start gap-2.5 border-l-2 border-terracotta/30 pl-3 text-[14.5px] text-charcoal-600"
                >
                  {customer}
                </li>
              ))}
            </ul>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-concrete-200 bg-cream-100 p-6">
              <h2 className="text-lg">Business details</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                    Registered name
                  </dt>
                  <dd className="mt-1 text-charcoal">{companyConfig.companyName}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                    Also known as
                  </dt>
                  <dd className="mt-1 text-charcoal">{companyConfig.alternateName}</dd>
                </div>
                {/* Third-party sourced — hidden until the owner confirms it. */}
                {disclosure.showProprietor && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                      Proprietor
                    </dt>
                    <dd className="mt-1 text-charcoal">{companyConfig.proprietor}</dd>
                  </div>
                )}
                {disclosure.showGstin && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                      GSTIN
                    </dt>
                    <dd className="mt-1 font-mono text-[13px] text-charcoal">
                      {companyConfig.gstin}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                    Office
                  </dt>
                  <dd className="mt-1 space-y-0.5 text-charcoal">
                    {fullAddressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                    Business hours
                  </dt>
                  <dd className="mt-1 space-y-0.5 text-charcoal">
                    {companyConfig.businessHours.map((entry) => (
                      <span key={entry.days} className="block">
                        {entry.days}: {entry.hours}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
              <Button to={paths.contact} variant="outline" size="md" block className="mt-6">
                Contact details
              </Button>
            </div>
          </aside>
        </div>
      </Section>

      <QuoteCta />
    </>
  )
}
