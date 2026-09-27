import { CircleAlert, Loader, Send } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { paths } from '../../lib/paths'
import {
  isValidEmail,
  isValidMobile,
  submitEnquiry,
  type EnquiryPayload,
  type EnquiryResult,
} from '../../lib/enquiry'
import { Button } from '../ui/Button'
import { TextAreaField, TextField } from './Field'
import { EnquirySuccess } from './EnquirySuccess'
import { useVerifiedSubmit } from '../../visitor/useVerifiedSubmit'
import { VerificationNotice } from '../../visitor/VerificationNotice'

type FieldName = 'name' | 'companyName' | 'mobile' | 'email' | 'message'

const emptyForm: Record<FieldName, string> = {
  name: '',
  companyName: '',
  mobile: '',
  email: '',
  message: '',
}

/**
 * Short general enquiry form for /contact. Detailed requirements belong on
 * /request-quote, which this form links to rather than duplicating.
 */
export function ContactForm() {
  const location = useLocation()
  const [values, setValues] = useState(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [result, setResult] = useState<EnquiryResult | null>(null)
  const [submitted, setSubmitted] = useState<EnquiryPayload | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const { submitVerified, otpAvailable, verificationDialog } = useVerifiedSubmit()

  function setField(field: FieldName) {
    return (value: string) => {
      setValues((current) => ({ ...current, [field]: value }))
      setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const next: Partial<Record<FieldName, string>> = {}
    if (values.name.trim().length < 2) next.name = 'Please enter your name.'
    if (!values.mobile.trim()) {
      next.mobile = 'A mobile number is needed so we can respond.'
    } else if (!isValidMobile(values.mobile)) {
      next.mobile = 'Enter a 10-digit Indian mobile number.'
    }
    if (values.email.trim() && !isValidEmail(values.email)) {
      next.email = 'Enter a valid email address, or leave this blank.'
    }
    if (values.message.trim().length < 10) {
      next.message = 'Please describe your enquiry in a little more detail.'
    }

    setErrors(next)
    if (Object.keys(next).length > 0) {
      window.requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }

    const payload: EnquiryPayload = {
      kind: 'contact',
      name: values.name.trim(),
      companyName: values.companyName.trim(),
      mobile: values.mobile.trim(),
      email: values.email.trim(),
      message: values.message.trim(),
      submittedAt: new Date().toISOString(),
      sourcePath: `${location.pathname}${location.search}`,
    }

    // Same gate as the quotation form: the form stays mounted through
    // verification, and the POST happens only after the server confirms it.
    submitVerified({
      phone: payload.mobile,
      profile: { name: payload.name, email: payload.email, company: payload.companyName },
      submit: async () => {
        setStatus('submitting')
        const outcome = await submitEnquiry(payload)
        setStatus('idle')

        if (outcome.status === 'error') {
          setResult(outcome)
          window.requestAnimationFrame(() => summaryRef.current?.focus())
          return
        }

        setSubmitted(payload)
        setResult(outcome)
      },
    })
  }

  if (result && submitted && result.status !== 'error') {
    return (
      <EnquirySuccess
        result={result}
        payload={submitted}
        onReset={() => {
          setValues(emptyForm)
          setErrors({})
          setResult(null)
          setSubmitted(null)
        }}
      />
    )
  }

  const errorList = Object.entries(errors).filter(([, message]) => Boolean(message))

  return (
    <form onSubmit={handleSubmit} noValidate className="border border-concrete-200 bg-cream-100 p-5 sm:p-7">
      <h2 className="text-xl">Send an enquiry</h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-concrete-700">
        For a detailed requirement with quantities and specifications, use the{' '}
        <Link
          to={paths.requestQuote}
          className="rounded-sm font-semibold text-terracotta underline-offset-4 hover:underline"
        >
          quotation form
        </Link>
        .
      </p>

      <div ref={summaryRef} tabIndex={-1} aria-live="polite" className="focus-visible:outline-none">
        {errorList.length > 0 && (
          <div className="mt-5 border border-terracotta/40 bg-terracotta-100 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-terracotta-700">
              <CircleAlert aria-hidden="true" className="h-4 w-4" />
              Please check {errorList.length} {errorList.length === 1 ? 'field' : 'fields'}
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] text-charcoal-600">
              {errorList.map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        {result?.status === 'error' && (
          <div className="mt-5 border border-terracotta/40 bg-terracotta-100 p-4">
            <p className="flex items-start gap-2 text-sm text-charcoal">
              <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-700" />
              {result.message}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <TextField
          label="Name"
          name="name"
          value={values.name}
          onChange={setField('name')}
          error={errors.name}
          required
          autoComplete="name"
        />
        <TextField
          label="Company name"
          name="companyName"
          value={values.companyName}
          onChange={setField('companyName')}
          error={errors.companyName}
          autoComplete="organization"
        />
        <TextField
          label="Mobile"
          name="mobile"
          type="tel"
          inputMode="tel"
          value={values.mobile}
          onChange={setField('mobile')}
          error={errors.mobile}
          required
          autoComplete="tel"
          placeholder="98765 43210"
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          value={values.email}
          onChange={setField('email')}
          error={errors.email}
          autoComplete="email"
        />
        <TextAreaField
          label="Your enquiry"
          name="message"
          value={values.message}
          onChange={setField('message')}
          error={errors.message}
          required
          className="sm:col-span-2"
          placeholder="Tell us what you need — products, quantities, site location or anything else."
        />
      </div>

      <VerificationNotice phone={values.mobile} />

      <div className="mt-6 border-t border-concrete-200 pt-5">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={status === 'submitting' || !otpAvailable}
          block
        >
          {status === 'submitting' ? (
            <>
              <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Send aria-hidden="true" className="h-4 w-4" />
              Send enquiry
            </>
          )}
        </Button>
      </div>

      {/* Inside the form, so its state survives the verification step. */}
      {verificationDialog}
    </form>
  )
}
