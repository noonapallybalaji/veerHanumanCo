import { Mail, MapPin, Phone } from 'lucide-react'
import { companyConfig } from '../../data/company'
import { emailHref, formatPhone, hasEmail, hasPhone, telHref } from '../../lib/contact'

/**
 * Slim utility bar above the header: location, what we quote for, and the
 * direct contact routes. It is the first thing a procurement person looks
 * for, so it sits above everything else rather than in the footer.
 *
 * Every item reads from companyConfig and is skipped when its value is
 * not set, so the bar stays tidy while contact details are still being
 * confirmed. Fill in `phone` / `email` in src/data/company.ts and they
 * appear here (and everywhere else) automatically.
 *
 * Not sticky: it scrolls away and the header alone stays pinned, which
 * keeps the usable viewport large on laptops.
 */
export function TopBar() {
  const location = `${companyConfig.address.city}, ${companyConfig.address.state}, India`

  return (
    <div className="border-b border-cream/10 bg-charcoal-900 text-cream on-dark">
      <div className="shell flex min-h-[38px] flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-[11px] font-medium uppercase tracking-[0.12em] sm:justify-start">
        <span className="inline-flex items-center gap-1.5 text-cream/75">
          <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-terracotta-400" />
          {location}
        </span>

        <Divider />

        <span className="text-terracotta-400">Project &amp; bulk enquiries welcome</span>

        {hasPhone && telHref && (
          <>
            <Divider />
            <a
              href={telHref}
              className="inline-flex items-center gap-1.5 rounded-sm text-cream/75 transition-colors hover:text-cream"
            >
              <Phone aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-terracotta-400" />
              <span className="tracking-[0.08em]">{formatPhone()}</span>
            </a>
          </>
        )}

        {hasEmail && emailHref && (
          <>
            <Divider />
            <a
              href={emailHref}
              className="inline-flex items-center gap-1.5 rounded-sm text-cream/75 transition-colors hover:text-cream"
            >
              <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-terracotta-400" />
              <span className="normal-case tracking-[0.04em]">{companyConfig.email}</span>
            </a>
          </>
        )}
      </div>
    </div>
  )
}

/** Hidden on the narrowest screens, where the bar wraps onto two lines. */
function Divider() {
  return (
    <span aria-hidden="true" className="hidden text-cream/25 sm:inline">
      |
    </span>
  )
}
