import { useLocation } from 'react-router-dom'
import { generalEnquiryMessage, hasWhatsApp, whatsAppHref } from '../../lib/contact'
import { paths } from '../../lib/paths'

/**
 * Floating WhatsApp contact button.
 *
 * Reuses `whatsAppHref` from lib/contact — the single place that builds a
 * wa.me URL from `companyConfig.whatsapp` — so this button can never drift
 * to a different number or encoding than the header, footer, product pages
 * and mobile bar.
 *
 * It renders nothing when no number is configured, rather than linking to a
 * guessed one. That is the safe state, and the admin panel is where the
 * number gets set (Company & Contact).
 *
 * DESKTOP ONLY, from `lg` up. Below that, MobileActionBar already pins a
 * full-width WhatsApp button to the bottom of the screen; a floating circle
 * directly above it is the same action twice, a few pixels apart, and the
 * bar is the better target of the two.
 *
 * z-40 keeps it below the modals and the OTP dialog (z-90/95) so it can
 * never cover their controls.
 */

/** Public routes where a floating contact button is unhelpful or intrusive. */
const HIDDEN_ON: string[] = [
  paths.requestQuote, // the page IS the enquiry form; a second CTA competes
  paths.contact, // already covered by the contact options on the page
]

/**
 * Route visibility, separated from rendering so it can be tested directly
 * without mounting a router. A trailing slash is treated as the same route.
 */
export function showsOnRoute(pathname: string): boolean {
  // Never on the admin panel or its sign-in page.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return false
  const normalised = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return !HIDDEN_ON.includes(normalised)
}

export function FloatingWhatsApp() {
  const { pathname } = useLocation()

  if (!showsOnRoute(pathname)) return null

  const message = generalEnquiryMessage()
  const href = whatsAppHref(message)

  /*
   * No configured number -> render nothing at all. A disabled-looking
   * floating button would be worse than its absence: it implies a channel
   * that does not exist.
   */
  if (!hasWhatsApp || !href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp — opens WhatsApp in a new tab"
      className={[
        // Hidden below lg, where MobileActionBar owns this action.
        'hidden lg:inline-flex',
        'fixed right-6 bottom-6',
        // Below modals (z-90+) and the OTP dialog (z-95), above page content.
        'z-40',
        'group items-center gap-2.5 rounded-full bg-whatsapp py-3 pl-3.5 pr-4 text-white shadow-lift',
        'transition-colors duration-200 ease-subtle hover:bg-whatsapp-dark',
        // Visible keyboard focus, offset so the ring is not lost on the pill.
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp-dark focus-visible:ring-offset-2 focus-visible:ring-offset-cream',
        'motion-safe:hover:-translate-y-0.5 motion-safe:transition-transform',
      ].join(' ')}
    >
      <WhatsAppGlyph />
      <span className="text-sm font-semibold">WhatsApp</span>
    </a>
  )
}

/**
 * The WhatsApp glyph, inline.
 *
 * lucide-react has no brand icons, so its generic `MessageCircle` is used
 * elsewhere in the UI. For the primary floating action the real mark is
 * clearer, so it is drawn here rather than pulling in a brand-icon package
 * for one path. Decorative: the link carries the accessible name.
 */
function WhatsAppGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0 fill-current"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.99 2.898 9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.887 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}
