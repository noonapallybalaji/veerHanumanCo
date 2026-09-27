import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { activeServices, productCategories } from '../../data'
import { companyConfig } from '../../data/company'
import {
  emailHref,
  formatPhone,
  fullAddressLines,
  generalEnquiryMessage,
  hasEmail,
  hasPhone,
  telHref,
} from '../../lib/contact'
import { categoryUrl, paths, serviceUrl } from '../../lib/paths'
import { Button } from '../ui/Button'
import { WhatsAppButton } from '../ui/WhatsAppButton'
import { Logo } from './Logo'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-charcoal-700 bg-charcoal text-cream on-dark">
      <div className="shell py-14 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* Company */}
          <div>
            <Logo tone="dark" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-cream/60">
              Hyderabad-based supplier and contractor for RCC, FRP, drainage and piping products
              used in construction, civil infrastructure and landscaping work.
            </p>
            <p className="mt-4 text-[13px] text-cream/45">
              Established {companyConfig.establishedYear} · {companyConfig.businessStructure}
            </p>
          </div>

          {/* Products */}
          <nav aria-label="Products">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/45">
              Products
            </h2>
            <ul className="mt-4 space-y-2.5">
              {productCategories.map((category) => (
                <li key={category.id}>
                  <Link
                    to={categoryUrl(category)}
                    className="rounded-sm text-sm text-cream/80 transition-colors hover:text-cream"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to={paths.products}
                  className="rounded-sm text-sm text-cream/80 transition-colors hover:text-cream"
                >
                  Full catalogue
                </Link>
              </li>
            </ul>

            <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/45">
              Services
            </h2>
            <ul className="mt-4 space-y-2.5">
              {activeServices.map((service) => (
                <li key={service.id}>
                  <Link
                    to={serviceUrl(service)}
                    className="rounded-sm text-sm text-cream/80 transition-colors hover:text-cream"
                  >
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company links */}
          <nav aria-label="Company">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/45">
              Company
            </h2>
            <ul className="mt-4 space-y-2.5">
              {[
                { label: 'About Us', to: paths.about },
                { label: 'Projects', to: paths.projects },
                { label: 'Contact', to: paths.contact },
                { label: 'Request a Quote', to: paths.requestQuote },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="rounded-sm text-sm text-cream/80 transition-colors hover:text-cream"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/45">
              Contact
            </h2>
            <address className="mt-4 space-y-3 text-sm not-italic text-cream/70">
              <p className="flex gap-2.5">
                <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cream/40" />
                <span>
                  {fullAddressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </p>
              {hasPhone && telHref && (
                <p className="flex gap-2.5">
                  <Phone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cream/40" />
                  <a href={telHref} className="rounded-sm hover:text-cream">
                    {formatPhone()}
                  </a>
                </p>
              )}
              {hasEmail && emailHref && (
                <p className="flex gap-2.5">
                  <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cream/40" />
                  <a href={emailHref} className="rounded-sm break-all hover:text-cream">
                    {companyConfig.email}
                  </a>
                </p>
              )}
              <p className="flex gap-2.5">
                <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cream/40" />
                <span>
                  {companyConfig.businessHours.map((entry) => (
                    <span key={entry.days} className="block">
                      {entry.days}: {entry.hours}
                    </span>
                  ))}
                </span>
              </p>
            </address>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button to={paths.requestQuote} variant="accent" size="sm">
                Request a Quote
              </Button>
              <WhatsAppButton message={generalEnquiryMessage()} size="sm" tone="onDark" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-cream/10">
        <div className="shell flex flex-col gap-2 py-5 text-[13px] text-cream/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {companyConfig.companyName}. All rights reserved.
          </p>
          <p>
            {companyConfig.address.city}, {companyConfig.address.state}
            {companyConfig.disclosure.showGstin && <> · GSTIN {companyConfig.gstin}</>}
          </p>
        </div>
      </div>
    </footer>
  )
}
