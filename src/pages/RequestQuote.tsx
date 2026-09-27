import { Clock, MapPin, Phone } from 'lucide-react'
import { QuoteForm } from '../components/forms/QuoteForm'
import { PageHeader } from '../components/ui/PageHeader'
import { Section } from '../components/ui/Section'
import { WhatsAppButton } from '../components/ui/WhatsAppButton'
import { Button } from '../components/ui/Button'
import { companyConfig } from '../data/company'
import { formatPhone, generalEnquiryMessage, hasPhone, telHref } from '../lib/contact'
import { paths } from '../lib/paths'
import { breadcrumbSchema } from '../lib/schema'
import { Seo } from '../lib/seo'

export default function RequestQuote() {
  return (
    <>
      <Seo
        title="Request a Quote"
        description="Send your product requirement to Veer Hanuman Trading Co., Hyderabad — product, quantity, size or specification and delivery location — and receive a requirement-based quotation."
        path={paths.requestQuote}
        schema={breadcrumbSchema([
          { name: 'Home', path: paths.home },
          { name: 'Request a Quote', path: paths.requestQuote },
        ])}
      />

      <PageHeader
        crumbs={[{ name: 'Home', path: paths.home }, { name: 'Request a Quote' }]}
        eyebrow="Request a quotation"
        title="Send your project requirement"
        intro="Quotations are prepared against what you share — product, quantity, size or specification, and where it needs to reach. Project and bulk quantities are welcome, as are single line items."
        aside={
          /* Describes the process only. No response-time promises, because
             none were supplied and a missed one costs more than it gains. */
          <ol className="divide-y divide-cream/10 border border-cream/15">
            {[
              { step: '01', title: 'Send your requirement', detail: 'Use the form, WhatsApp or phone.' },
              {
                step: '02',
                title: 'We review availability',
                detail: 'Against the sizes, quantities and delivery details you share.',
              },
              {
                step: '03',
                title: 'You receive a quotation',
                detail: 'Priced to your requirement, not to a fixed list.',
              },
            ].map((item) => (
              <li key={item.step} className="flex gap-4 px-5 py-4">
                <span className="font-display text-sm font-extrabold text-terracotta-400">
                  {item.step}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-cream">{item.title}</span>
                  <span className="mt-1 block text-[12.5px] leading-snug text-cream/55">
                    {item.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        }
      />

      <Section tone="cream">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <QuoteForm />

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="border border-concrete-200 bg-cream-100 p-6">
              <h2 className="text-lg">What helps us quote faster</h2>
              <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-concrete-700">
                {[
                  'The product and, where known, the size or diameter.',
                  'Quantity — numbers, running metres, or the BOQ line quantity.',
                  'Delivery location, so transport can be considered.',
                  'When the material is needed on site.',
                  'Any other line items on the same requirement.',
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 bg-terracotta" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-concrete-200 bg-cream-100 p-6">
              <h2 className="text-lg">Prefer to talk?</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-concrete-700">
                Reach us during business hours, or send the requirement over WhatsApp.
              </p>
              <div className="mt-4 space-y-2.5">
                {hasPhone && telHref && (
                  <Button href={telHref} variant="outline" size="md" block newTab={false}>
                    <Phone aria-hidden="true" className="h-4 w-4" />
                    {formatPhone()}
                  </Button>
                )}
                <WhatsAppButton message={generalEnquiryMessage()} size="md" block />
              </div>
              <dl className="mt-5 space-y-3.5 border-t border-concrete-200 pt-4 text-[13.5px]">
                <div className="flex gap-2.5">
                  <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-concrete" />
                  <div>
                    <dt className="font-semibold text-charcoal">Business hours</dt>
                    <dd className="mt-0.5 space-y-0.5 text-concrete-700">
                      {companyConfig.businessHours.map((entry) => (
                        <span key={entry.days} className="block">
                          {entry.days}: {entry.hours}
                        </span>
                      ))}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-concrete" />
                  <div>
                    <dt className="font-semibold text-charcoal">Location</dt>
                    <dd className="mt-0.5 text-concrete-700">
                      {companyConfig.address.city}, {companyConfig.address.state}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </Section>
    </>
  )
}
