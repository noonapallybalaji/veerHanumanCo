import { CircleAlert, Loader, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { getQuotableItems, projectTypes } from '../../data'
import {
  isValidEmail,
  isValidMobile,
  submitEnquiry,
  type EnquiryPayload,
  type EnquiryResult,
} from '../../lib/enquiry'
import { Button } from '../ui/Button'
import { SelectField, TextAreaField, TextField } from './Field'
import { EnquirySuccess } from './EnquirySuccess'
import { useVerifiedSubmit } from '../../visitor/useVerifiedSubmit'
import { VerificationNotice } from '../../visitor/VerificationNotice'

type FieldName =
  | 'name'
  | 'companyName'
  | 'mobile'
  | 'whatsapp'
  | 'email'
  | 'product'
  | 'quantity'
  | 'specification'
  | 'projectType'
  | 'deliveryLocation'
  | 'requirementDate'
  | 'message'

const emptyForm: Record<FieldName, string> = {
  name: '',
  companyName: '',
  mobile: '',
  whatsapp: '',
  email: '',
  product: '',
  quantity: '',
  specification: '',
  projectType: '',
  deliveryLocation: '',
  requirementDate: '',
  message: '',
}

const OTHER_PRODUCT = 'Other / multiple products'

/**
 * B2B requirement form.
 *
 * Product options come from the catalogue via `getQuotableItems()`, so
 * adding a product to the data layer adds it here automatically. The
 * product can also be pre-selected through ?product= — that is how the
 * "Get a Quote" action on every product card and detail page keeps context.
 */
export function QuoteForm() {
  const [params] = useSearchParams()
  const location = useLocation()
  const [values, setValues] = useState(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [result, setResult] = useState<EnquiryResult | null>(null)
  const [submitted, setSubmitted] = useState<EnquiryPayload | null>(null)
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const { submitVerified, otpAvailable, verificationDialog } = useVerifiedSubmit()

  const productOptions = [
    ...getQuotableItems(),
    { value: OTHER_PRODUCT, label: OTHER_PRODUCT, group: 'Other' },
  ]

  // Pre-select the product passed in the URL, matching on the option label.
  const requestedProduct = params.get('product')
  useEffect(() => {
    if (!requestedProduct) return
    const match = productOptions.find(
      (option) => option.value.toLowerCase() === requestedProduct.toLowerCase(),
    )
    setValues((current) => ({
      ...current,
      product: match ? match.value : OTHER_PRODUCT,
      specification:
        !match && current.specification.length === 0 ? `Requirement: ${requestedProduct}` : current.specification,
    }))
    // productOptions is derived from static data and stable in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedProduct])

  function setField(field: FieldName) {
    return (value: string) => {
      setValues((current) => ({ ...current, [field]: value }))
      // Clear the error as soon as the visitor starts fixing the field.
      setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
    }
  }

  function validate(): Partial<Record<FieldName, string>> {
    const next: Partial<Record<FieldName, string>> = {}

    if (values.name.trim().length < 2) {
      next.name = 'Please enter your name.'
    }
    if (!values.mobile.trim()) {
      next.mobile = 'A mobile number is needed so we can respond.'
    } else if (!isValidMobile(values.mobile)) {
      next.mobile = 'Enter a 10-digit Indian mobile number, for example 98765 43210.'
    }
    if (values.whatsapp.trim() && !isValidMobile(values.whatsapp)) {
      next.whatsapp = 'Enter a 10-digit mobile number, or leave this blank.'
    }
    if (values.email.trim() && !isValidEmail(values.email)) {
      next.email = 'Enter a valid email address, or leave this blank.'
    }
    if (!values.product) {
      next.product = 'Select the product or service you need.'
    }
    if (!values.projectType) {
      next.projectType = 'Select the closest project type.'
    }

    return next
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validate()
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      // Move focus to the summary so keyboard and screen-reader users land
      // on the errors rather than being left at the submit button.
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus())
      return
    }

    const payload: EnquiryPayload = {
      kind: 'quote',
      name: values.name.trim(),
      companyName: values.companyName.trim(),
      mobile: values.mobile.trim(),
      whatsapp: values.whatsapp.trim(),
      email: values.email.trim(),
      product: values.product,
      quantity: values.quantity.trim(),
      specification: values.specification.trim(),
      projectType: values.projectType,
      deliveryLocation: values.deliveryLocation.trim(),
      requirementDate: values.requirementDate,
      message: values.message.trim(),
      submittedAt: new Date().toISOString(),
      sourcePath: `${location.pathname}${location.search}`,
    }

    /*
     * Verification gate. The form stays mounted while the OTP dialog is up,
     * so `payload` and every field the visitor typed survive intact, and the
     * POST only happens after the server confirms the code.
     */
    submitVerified({
      phone: payload.mobile,
      profile: { name: payload.name, email: payload.email, company: payload.companyName },
      submit: async () => {
        setStatus('submitting')
        const outcome = await submitEnquiry(payload)
        setStatus('idle')

        if (outcome.status === 'error') {
          setResult(outcome)
          window.requestAnimationFrame(() => errorSummaryRef.current?.focus())
          return
        }

        setSubmitted(payload)
        setResult(outcome)
      },
    })
  }

  function reset() {
    setValues(emptyForm)
    setErrors({})
    setResult(null)
    setSubmitted(null)
  }

  if (result && submitted && result.status !== 'error') {
    return <EnquirySuccess result={result} payload={submitted} onReset={reset} />
  }

  const errorList = Object.entries(errors).filter(([, message]) => Boolean(message))

  return (
    <form onSubmit={handleSubmit} noValidate className="border border-concrete-200 bg-cream-100 p-5 sm:p-8">
      <h2 className="text-[22px] sm:text-[26px]">Project requirement</h2>
      <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-concrete-700">
        The more detail you share on quantity, size and delivery location, the closer the first
        quotation will be. Fields marked * are needed to respond.
      </p>

      {/* Error summary + submission failure, one focusable region */}
      <div
        ref={errorSummaryRef}
        tabIndex={-1}
        aria-live="polite"
        className="focus-visible:outline-none"
      >
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

      <fieldset className="mt-7">
        <legend className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-concrete">
          Your details
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Name"
            name="name"
            value={values.name}
            onChange={setField('name')}
            error={errors.name}
            required
            autoComplete="name"
            placeholder="Full name"
          />
          <TextField
            label="Company name"
            name="companyName"
            value={values.companyName}
            onChange={setField('companyName')}
            error={errors.companyName}
            autoComplete="organization"
            placeholder="Firm or organisation"
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
            label="WhatsApp number"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            value={values.whatsapp}
            onChange={setField('whatsapp')}
            error={errors.whatsapp}
            hint="Only if different from your mobile number."
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
            placeholder="name@company.com"
            className="sm:col-span-2"
          />
        </div>
      </fieldset>

      <fieldset className="mt-9">
        <legend className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-concrete">
          Requirement
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Product or service"
            name="product"
            value={values.product}
            onChange={setField('product')}
            error={errors.product}
            required
            options={productOptions}
            placeholder="Select from the catalogue"
          />
          <SelectField
            label="Project type"
            name="projectType"
            value={values.projectType}
            onChange={setField('projectType')}
            error={errors.projectType}
            required
            options={projectTypes.map((type) => ({ value: type, label: type }))}
            placeholder="Select project type"
          />
          <TextField
            label="Quantity"
            name="quantity"
            value={values.quantity}
            onChange={setField('quantity')}
            error={errors.quantity}
            hint="Numbers, metres, or BOQ line quantity."
            placeholder="e.g. 120 nos. / 500 m"
          />
          <TextField
            label="Size / specification"
            name="specification"
            value={values.specification}
            onChange={setField('specification')}
            error={errors.specification}
            hint="Diameter, opening size or the specification in your BOQ."
            placeholder="e.g. 600 mm dia."
          />
          <TextField
            label="Delivery location"
            name="deliveryLocation"
            value={values.deliveryLocation}
            onChange={setField('deliveryLocation')}
            error={errors.deliveryLocation}
            placeholder="Site area, city"
          />
          <TextField
            label="Expected requirement date"
            name="requirementDate"
            type="date"
            value={values.requirementDate}
            onChange={setField('requirementDate')}
            error={errors.requirementDate}
            hint="Approximate is fine."
          />
          <TextAreaField
            label="Additional requirements"
            name="message"
            value={values.message}
            onChange={setField('message')}
            error={errors.message}
            className="sm:col-span-2"
            placeholder="Other line items, site conditions, or anything else we should know."
          />
        </div>
      </fieldset>

      <VerificationNotice phone={values.mobile} />

      <div className="mt-6 flex flex-col gap-3 border-t border-concrete-200 pt-6 sm:flex-row sm:items-center">
        <Button
          type="submit"
          variant="accent"
          size="lg"
          disabled={status === 'submitting' || !otpAvailable}
        >
          {status === 'submitting' ? (
            <>
              <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Send aria-hidden="true" className="h-4 w-4" />
              Submit enquiry
            </>
          )}
        </Button>
        <p className="text-[13px] leading-relaxed text-concrete">
          We use these details only to respond to your enquiry.
        </p>
      </div>

      {/* Rendered inside the form so its state stays mounted during verification. */}
      {verificationDialog}
    </form>
  )
}
