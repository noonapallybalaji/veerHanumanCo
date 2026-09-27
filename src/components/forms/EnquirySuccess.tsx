import { Check, Copy, Mail, MessageCircle, Phone } from 'lucide-react'
import { useState } from 'react'
import {
  emailHref,
  formatPhone,
  hasEmail,
  hasPhone,
  quoteEnquiryMessage,
  telHref,
  whatsAppHref,
} from '../../lib/contact'
import { enquiryFields, type EnquiryPayload, type EnquiryResult } from '../../lib/enquiry'
import { Button } from '../ui/Button'

interface EnquirySuccessProps {
  result: Extract<EnquiryResult, { status: 'sent' | 'unavailable' }>
  payload: EnquiryPayload
  onReset: () => void
}

/**
 * Post-submission state.
 *
 * Two genuinely different outcomes, worded accurately:
 *  - 'sent': the API stored the enquiry and it is in the admin panel, so
 *    this confirms receipt and shows the reference.
 *  - 'unavailable': the API could not be reached, so nothing was recorded.
 *    It says exactly that and hands the visitor their formatted enquiry to
 *    send over WhatsApp, by phone or by email. No false "we'll be in touch".
 */
export function EnquirySuccess({ result, payload, onReset }: EnquirySuccessProps) {
  const [copied, setCopied] = useState(false)
  const fields = enquiryFields(payload)
  const message = quoteEnquiryMessage(fields)
  const waHref = whatsAppHref(message)

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  const sent = result.status === 'sent'

  return (
    <div className="border border-concrete-200 bg-cream-100 p-6 sm:p-8" role="status">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-sm bg-moss text-white"
      >
        <Check className="h-5 w-5" />
      </span>

      <h2 className="mt-5 text-[22px] sm:text-[26px]">
        {sent ? 'Enquiry received' : 'Your enquiry is ready to send'}
      </h2>

      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-charcoal-600">
        {sent ? (
          <>
            Thank you, {payload.name.split(' ')[0]}. Your requirement has been received and our team
            will review it against availability and come back with a quotation.
            {result.status === 'sent' && result.reference && (
              <>
                {' '}
                Your reference is{' '}
                <span className="font-mono font-semibold text-charcoal">{result.reference}</span>.
              </>
            )}{' '}
            For anything urgent, reach us directly using the options below.
          </>
        ) : (
          <>
            Thank you, {payload.name.split(' ')[0]}. Your requirement is prepared below, ready to
            send. To be straight with you: we could not reach our system just now, so nothing has
            been recorded at our end. Send it in one tap over WhatsApp, or copy it and send it
            however suits you.
          </>
        )}
      </p>

      {/* Summary of what was entered */}
      <dl className="mt-6 divide-y divide-concrete-200 border-y border-concrete-200">
        {fields
          .filter((field) => field.value.trim().length > 0)
          .map((field) => (
            <div key={field.label} className="grid gap-0.5 py-2.5 sm:grid-cols-[190px_1fr]">
              <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-concrete">
                {field.label}
              </dt>
              <dd className="whitespace-pre-line text-[14.5px] text-charcoal">{field.value}</dd>
            </div>
          ))}
      </dl>

      <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        {waHref && (
          <Button href={waHref} variant="whatsapp" size="lg">
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            {sent ? 'Also send on WhatsApp' : 'Send on WhatsApp'}
          </Button>
        )}
        <Button variant="outline" size="lg" onClick={copyToClipboard}>
          {copied ? (
            <>
              <Check aria-hidden="true" className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy aria-hidden="true" className="h-4 w-4" />
              Copy enquiry
            </>
          )}
        </Button>
        {hasPhone && telHref && (
          <Button href={telHref} variant="outline" size="lg" newTab={false}>
            <Phone aria-hidden="true" className="h-4 w-4" />
            {formatPhone()}
          </Button>
        )}
        {hasEmail && emailHref && (
          <Button
            href={`${emailHref}?subject=${encodeURIComponent('Project requirement enquiry')}&body=${encodeURIComponent(message)}`}
            variant="outline"
            size="lg"
            newTab={false}
          >
            <Mail aria-hidden="true" className="h-4 w-4" />
            Email
          </Button>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {copied ? 'Enquiry copied to clipboard' : ''}
      </p>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded-sm text-sm font-semibold text-terracotta underline-offset-4 hover:underline"
      >
        Submit another requirement
      </button>
    </div>
  )
}
