import { CircleAlert, ShieldCheck } from 'lucide-react'
import { useVisitor } from './VisitorContext'

/**
 * Tells the visitor, before they fill anything in, what verification will be
 * required — and says so plainly when verification is unavailable, rather
 * than letting them complete a form the server will refuse.
 */
export function VerificationNotice({ phone }: { phone?: string }) {
  const { visitor, capability } = useVisitor()

  if (!capability) return null

  if (!capability.otpAvailable) {
    return (
      <p
        role="alert"
        className="mt-5 flex items-start gap-2.5 border border-terracotta/40 bg-terracotta-100 p-3.5 text-[13px] leading-relaxed text-charcoal"
      >
        <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-700" />
        <span>
          Phone verification is unavailable at the moment, so we cannot accept this form. Please
          call or message us instead and we will pick it up straight away.
        </span>
      </p>
    )
  }

  const digits = (value: string) => value.replace(/[^\d]/g, '').slice(-10)
  const verifiedForThis =
    visitor?.phoneVerified && phone && digits(visitor.phone) === digits(phone)

  if (verifiedForThis) {
    return (
      <p className="mt-5 flex items-start gap-2.5 border border-moss/30 bg-moss-100 p-3.5 text-[13px] leading-relaxed text-moss-700">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          This number is already verified on this device, so your enquiry will send straight away.
        </span>
      </p>
    )
  }

  return (
    <p className="mt-5 flex items-start gap-2.5 border border-concrete-200 bg-cream p-3.5 text-[13px] leading-relaxed text-concrete-700">
      <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-concrete" />
      <span>
        We will text a short code to confirm your number before sending this. It keeps quotations
        going to real requirements, and you will only need to do it once on this device.
      </span>
    </p>
  )
}
