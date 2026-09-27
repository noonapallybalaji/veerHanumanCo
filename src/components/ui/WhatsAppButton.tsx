import { MessageCircle } from 'lucide-react'
import { hasWhatsApp, whatsAppHref } from '../../lib/contact'
import { Button } from './Button'

interface WhatsAppButtonProps {
  /** Prefilled message — build it with the helpers in lib/contact.ts. */
  message: string
  label?: string
  size?: 'sm' | 'md' | 'lg'
  /** 'whatsapp' green fill, or a restrained outline for dense layouts. */
  tone?: 'solid' | 'outline' | 'onDark'
  block?: boolean
  className?: string
}

/**
 * Renders nothing when no WhatsApp number is configured, so the site never
 * links to an invented number. Fill in companyConfig.whatsapp to enable
 * every WhatsApp action at once.
 */
export function WhatsAppButton({
  message,
  label = 'WhatsApp',
  size = 'md',
  tone = 'solid',
  block,
  className,
}: WhatsAppButtonProps) {
  const href = whatsAppHref(message)
  if (!hasWhatsApp || !href) return null

  return (
    <Button
      href={href}
      variant={tone === 'solid' ? 'whatsapp' : tone === 'onDark' ? 'onDark' : 'outline'}
      size={size}
      block={block}
      className={className}
      aria-label={`${label} enquiry — opens WhatsApp in a new tab`}
    >
      <MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
      {label}
    </Button>
  )
}
