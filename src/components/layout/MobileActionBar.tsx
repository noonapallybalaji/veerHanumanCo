import { FileText, MessageCircle, Phone } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { generalEnquiryMessage, hasPhone, hasWhatsApp, telHref, whatsAppHref } from '../../lib/contact'
import { paths } from '../../lib/paths'

/**
 * Fixed Call | WhatsApp | Get Quote bar for mobile.
 *
 * Only actions with configured contact details are rendered, so the bar
 * never links to an invented number. It is hidden on the quote page, where
 * the form itself is the action.
 */
export function MobileActionBar() {
  const location = useLocation()
  const whatsApp = whatsAppHref(generalEnquiryMessage())
  const onQuotePage = location.pathname === paths.requestQuote

  if (onQuotePage) return null

  const actions = [
    hasPhone && telHref
      ? { key: 'call', label: 'Call', href: telHref, icon: Phone, tone: 'neutral' as const }
      : null,
    hasWhatsApp && whatsApp
      ? {
          key: 'whatsapp',
          label: 'WhatsApp',
          href: whatsApp,
          icon: MessageCircle,
          tone: 'whatsapp' as const,
          external: true,
        }
      : null,
  ].filter(Boolean) as {
    key: string
    label: string
    href: string
    icon: typeof Phone
    tone: 'neutral' | 'whatsapp'
    external?: boolean
  }[]

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-concrete-200 bg-cream-100/95 backdrop-blur lg:hidden">
      <div className="flex items-stretch gap-2 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <a
              key={action.key}
              href={action.href}
              {...(action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={
                action.tone === 'whatsapp'
                  ? 'flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-sm bg-whatsapp text-sm font-semibold text-white'
                  : 'flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-sm border border-charcoal/20 text-sm font-semibold text-charcoal'
              }
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {action.label}
            </a>
          )
        })}
        <Link
          to={paths.requestQuote}
          className="flex min-h-[48px] flex-[1.3] items-center justify-center gap-1.5 rounded-sm bg-charcoal text-sm font-semibold text-cream"
        >
          <FileText aria-hidden="true" className="h-4 w-4" />
          Get a Quote
        </Link>
      </div>
    </div>
  )
}
