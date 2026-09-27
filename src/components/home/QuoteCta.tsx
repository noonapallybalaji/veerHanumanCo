import { ArrowRight, Clock, Mail, Phone } from 'lucide-react'
import { companyConfig } from '../../data/company'
import {
  emailHref,
  formatPhone,
  generalEnquiryMessage,
  hasEmail,
  hasPhone,
  telHref,
} from '../../lib/contact'
import { paths } from '../../lib/paths'
import { Button } from '../ui/Button'
import { WhatsAppButton } from '../ui/WhatsAppButton'

/** Closing conversion band. "Get a Quote" stays the primary action. */
export function QuoteCta() {
  return (
    <section className="bg-charcoal text-cream on-dark">
      <div className="shell grid gap-10 py-14 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:py-16">
        <div>
          <p className="eyebrow mb-4 text-terracotta-400 before:bg-terracotta-400/60">
            Request a quotation
          </p>
          <h2 className="max-w-xl text-[28px] leading-[1.1] sm:text-[34px]">
            Send your requirement and we will come back with a quotation
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-cream/65">
            Share the product, quantity, size or specification and delivery location. For BOQ-based
            requirements, include the relevant line items and we will review them together.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button to={paths.requestQuote} variant="accent" size="lg">
              Get a Quote
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
            <WhatsAppButton message={generalEnquiryMessage()} size="lg" tone="onDark" />
            {hasPhone && telHref && (
              <Button href={telHref} variant="onDark" size="lg" newTab={false}>
                <Phone aria-hidden="true" className="h-4 w-4" />
                {formatPhone()}
              </Button>
            )}
          </div>
        </div>

        <dl className="space-y-5 border-t border-cream/15 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <div>
            <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/45">
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              Business hours
            </dt>
            <dd className="mt-2 space-y-0.5 text-sm text-cream/75">
              {companyConfig.businessHours.map((entry) => (
                <p key={entry.days}>
                  {entry.days}: {entry.hours}
                </p>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/45">
              Location
            </dt>
            <dd className="mt-2 text-sm text-cream/75">
              {companyConfig.address.city}, {companyConfig.address.state}
            </dd>
          </div>
          {hasEmail && emailHref && (
            <div>
              <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/45">
                <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                Email
              </dt>
              <dd className="mt-2 text-sm">
                <a href={emailHref} className="rounded-sm break-all text-cream/75 hover:text-cream">
                  {companyConfig.email}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  )
}
