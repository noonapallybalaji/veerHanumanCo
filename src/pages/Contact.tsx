import { Clock, Info, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { ContactForm } from '../components/forms/ContactForm'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Section } from '../components/ui/Section'
import { WhatsAppButton } from '../components/ui/WhatsAppButton'
import { companyConfig } from '../data/company'
import {
  emailHref,
  formatPhone,
  fullAddressLines,
  generalEnquiryMessage,
  hasEmail,
  hasPhone,
  hasWhatsApp,
  telHref,
} from '../lib/contact'
import { paths } from '../lib/paths'
import { breadcrumbSchema, organizationSchema } from '../lib/schema'
import { Seo } from '../lib/seo'

/**
 * Contact page.
 *
 * Phone, WhatsApp and email were not supplied, so those rows render only
 * once the values are set in data/company.ts — no invented numbers. The
 * warehouse address is gated behind `disclosure.showWarehouseAddress`
 * because it came from a third-party listing.
 */
export default function Contact() {
  const { disclosure, warehouseAddress } = companyConfig
  const showWarehouse = disclosure.showWarehouseAddress && warehouseAddress.isPublished
  const anyDirectContact = hasPhone || hasWhatsApp || hasEmail

  return (
    <>
      <Seo
        title="Contact Us"
        description={`Contact ${companyConfig.companyName} in ${companyConfig.address.city}, ${companyConfig.address.state} for RCC, FRP, drainage and piping product requirements. Office at Sunder Nagar Colony, Erragadda, Hyderabad.`}
        path={paths.contact}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: paths.home },
            { name: 'Contact', path: paths.contact },
          ]),
          organizationSchema(),
        ]}
      />

      <PageHeader
        crumbs={[{ name: 'Home', path: paths.home }, { name: 'Contact' }]}
        eyebrow="Contact"
        title="Talk to us about your requirement"
        intro="Send an enquiry, or reach us during business hours. For requirements with quantities and specifications, the quotation form captures everything we need in one go."
        actions={
          <>
            <Button to={paths.requestQuote} variant="accent" size="lg">
              Request a quotation
            </Button>
            <WhatsAppButton message={generalEnquiryMessage()} size="lg" tone="onDark" />
          </>
        }
        aside={
          <dl className="divide-y divide-cream/10 border border-cream/15">
            <div className="px-5 py-4">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/45">
                {companyConfig.address.label}
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-cream/80">
                {companyConfig.address.city}, {companyConfig.address.state} —{' '}
                {companyConfig.address.postalCode}
              </dd>
            </div>
            <div className="px-5 py-4">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/45">
                Business hours
              </dt>
              <dd className="mt-1.5 space-y-0.5 text-sm text-cream/80">
                {companyConfig.businessHours.map((entry) => (
                  <span key={entry.days} className="block">
                    {entry.days}: {entry.hours}
                  </span>
                ))}
              </dd>
            </div>
            <div className="px-5 py-4">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/45">
                Established
              </dt>
              <dd className="mt-1.5 text-sm text-cream/80">
                {companyConfig.establishedYear} · {companyConfig.businessStructure}
              </dd>
            </div>
          </dl>
        }
      />

      <Section tone="cream">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr]">
          {/* Contact details */}
          <div>
            <h2 className="text-[22px] sm:text-[26px]">Contact details</h2>

            <dl className="mt-6 divide-y divide-concrete-200 border-y border-concrete-200">
              <div className="flex gap-4 py-5">
                <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                    {companyConfig.address.label}
                  </dt>
                  <dd className="mt-1.5">
                    <address className="space-y-0.5 text-[15px] not-italic leading-relaxed text-charcoal">
                      <span className="block font-semibold">{companyConfig.companyName}</span>
                      {fullAddressLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                  </dd>
                </div>
              </div>

              {showWarehouse && (
                <div className="flex gap-4 py-5">
                  <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                      {warehouseAddress.label}
                    </dt>
                    <dd className="mt-1.5">
                      <address className="space-y-0.5 text-[15px] not-italic leading-relaxed text-charcoal">
                        {warehouseAddress.lines.map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                        <span className="block">
                          {warehouseAddress.city} – {warehouseAddress.postalCode}
                        </span>
                        <span className="block">
                          {warehouseAddress.state}, {warehouseAddress.country}
                        </span>
                      </address>
                    </dd>
                  </div>
                </div>
              )}

              {hasPhone && telHref && (
                <div className="flex gap-4 py-5">
                  <Phone aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                      Phone
                    </dt>
                    <dd className="mt-1.5 text-[15px]">
                      <a href={telHref} className="rounded-sm text-charcoal hover:text-terracotta">
                        {formatPhone()}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              {hasWhatsApp && (
                <div className="flex gap-4 py-5">
                  <MessageCircle
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-terracotta"
                  />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                      WhatsApp
                    </dt>
                    <dd className="mt-2">
                      <WhatsAppButton message={generalEnquiryMessage()} size="sm" />
                    </dd>
                  </div>
                </div>
              )}

              {hasEmail && emailHref && (
                <div className="flex gap-4 py-5">
                  <Mail aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                      Email
                    </dt>
                    <dd className="mt-1.5 text-[15px]">
                      <a
                        href={emailHref}
                        className="rounded-sm break-all text-charcoal hover:text-terracotta"
                      >
                        {companyConfig.email}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              <div className="flex gap-4 py-5">
                <Clock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                    Business hours
                  </dt>
                  <dd className="mt-1.5 space-y-0.5 text-[15px] text-charcoal">
                    {companyConfig.businessHours.map((entry) => (
                      <span key={entry.days} className="block">
                        <span className="font-medium">{entry.days}:</span> {entry.hours}
                      </span>
                    ))}
                  </dd>
                </div>
              </div>

              {/* GSTIN is third-party sourced — hidden until confirmed. */}
              {disclosure.showGstin && (
                <div className="flex gap-4 py-5">
                  <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                      GSTIN
                    </dt>
                    <dd className="mt-1.5 font-mono text-[14px] text-charcoal">
                      {companyConfig.gstin}
                    </dd>
                  </div>
                </div>
              )}
            </dl>

            {!anyDirectContact && (
              <p className="mt-6 flex items-start gap-2.5 border border-concrete-200 bg-cream-100 p-4 text-[13.5px] leading-relaxed text-concrete-700">
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-concrete" />
                <span>
                  Phone and WhatsApp details will be published here shortly. In the meantime, send
                  your requirement through the enquiry form and include the best number to reach
                  you on.
                </span>
              </p>
            )}
          </div>

          {/* Enquiry form */}
          <div>
            <ContactForm />
          </div>
        </div>
      </Section>
    </>
  )
}
