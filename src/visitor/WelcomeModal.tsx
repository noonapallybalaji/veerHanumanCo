import { Check, CircleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ApiRequestError, api } from '../lib/api'
import { cn } from '../lib/cn'
import { companyConfig } from '../data/company'
import { useFocusTrap } from '../lib/useFocusTrap'
import { Button } from '../components/ui/Button'
import { OtpDialog } from './OtpDialog'
import { useVisitor } from './VisitorContext'

/**
 * Welcome modal.
 *
 * Shown once per browser session (sessionStorage, so it returns on a new
 * tab/visit but never nags during one). It is entirely skippable: escape,
 * the backdrop, the close button and "Maybe later" all dismiss it, and the
 * site is fully usable without it.
 *
 * Verification here is OPTIONAL. Submitting without it saves an unverified
 * lead; verifying also signs the visitor in, so their later enquiry needs no
 * second verification.
 */

const DISMISS_KEY = 'vh_welcome_seen'
const SHOW_DELAY_MS = 1200

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    // Private mode or blocked storage: treat as seen rather than show the
    // modal on every navigation.
    return true
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* nothing we can do, and nothing that should break the page */
  }
}

interface FormState {
  name: string
  phone: string
  company: string
  email: string
  requirement: string
  consent: boolean
  marketingConsent: boolean
  website: string
}

const EMPTY: FormState = {
  name: '',
  phone: '',
  company: '',
  email: '',
  requirement: '',
  consent: false,
  marketingConsent: false,
  website: '',
}

export function WelcomeModal() {
  const { visitor, capability, loading } = useVisitor()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [done, setDone] = useState<'saved' | 'verified' | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Suspended while the OTP dialog is on top, so the two traps do not fight
  // over focus. `done` swaps the form out, so the name field is gone then.
  useFocusTrap(dialogRef, open && !verifying, {
    initialFocus: done ? undefined : firstFieldRef,
  })

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    // Wait for the session check: a returning, already-verified visitor
    // should not be greeted with a form asking who they are.
    if (loading) return
    if (visitor || alreadySeen()) return

    const timer = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [loading, visitor])

  useEffect(() => {
    if (!open) return

    function onKey(event: KeyboardEvent) {
      // While the OTP dialog is on top it owns Escape; otherwise one press
      // would close both and discard what the visitor typed.
      if (event.key === 'Escape' && !verifying) dismiss()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, verifying])

  function dismiss() {
    markSeen()
    setOpen(false)
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Please enter your name.'
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/[^\d]/g, '').slice(-10))) {
      next.phone = 'Enter a 10-digit Indian mobile number.'
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      next.email = 'Enter a valid email address, or leave it blank.'
    }
    if (!form.consent) next.consent = 'Please accept the contact consent to continue.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function saveLead(afterVerification: boolean) {
    setBusy(true)
    setBanner(null)
    try {
      await api.post('/api/visitor/leads', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        requirement: form.requirement.trim(),
        consent: true,
        marketingConsent: form.marketingConsent,
        source: 'welcome-modal',
        website: form.website,
      })
      markSeen()
      setDone(afterVerification ? 'verified' : 'saved')
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fieldErrors)
        setBanner(caught.message)
      } else {
        setBanner('We could not save your details just now. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const otpAvailable = capability?.otpAvailable ?? false

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex items-end justify-center bg-charcoal/60 sm:items-center sm:p-4"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) dismiss()
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          className="max-h-[92vh] w-full max-w-lg overflow-y-auto border border-concrete-200 bg-cream-100 shadow-lift sm:rounded-sm"
        >
          {done ? (
            <div className="p-6 sm:p-8">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-sm bg-moss text-white"
              >
                <Check className="h-5 w-5" />
              </span>
              <h2 id="welcome-title" className="mt-5 text-[22px]">
                Thank you, {form.name.trim().split(' ')[0]}
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-charcoal-600">
                {done === 'verified'
                  ? 'Your number is verified and you are signed in, so you will not need to verify again on this device. Our team will be in touch about your requirement.'
                  : 'We have your details and our team will be in touch. You can verify your number later when you send an enquiry.'}
              </p>
              <Button variant="primary" size="lg" className="mt-6" onClick={() => setOpen(false)}>
                Continue browsing
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (validate()) void saveLead(false)
              }}
              noValidate
              className="p-6 sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow mb-3">Welcome</p>
                  <h2 id="welcome-title" className="text-[22px] leading-snug sm:text-[26px]">
                    Tell us what you need
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Close and continue browsing"
                  className="rounded-sm p-1 text-concrete hover:text-charcoal"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>

              <p className="mt-2 text-[14px] leading-relaxed text-concrete-700">
                Share your requirement and {companyConfig.companyName.replace(/\.$/, '')} will come
                back with availability and a quotation. It takes a moment, and you can skip it.
              </p>

              {banner && (
                <p
                  role="alert"
                  className="mt-4 flex items-start gap-2 border border-terracotta/40 bg-terracotta-100 p-3 text-[13px] text-charcoal"
                >
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-700"
                  />
                  {banner}
                </p>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Your name" required error={errors.name}>
                  <input
                    ref={firstFieldRef}
                    value={form.name}
                    onChange={(event) => set('name', event.target.value)}
                    autoComplete="name"
                    className={fieldClass(errors.name)}
                  />
                </Field>
                <Field label="Mobile number" required error={errors.phone}>
                  <input
                    value={form.phone}
                    onChange={(event) => set('phone', event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="98765 43210"
                    className={fieldClass(errors.phone)}
                  />
                </Field>
                <Field label="Company" error={errors.company}>
                  <input
                    value={form.company}
                    onChange={(event) => set('company', event.target.value)}
                    autoComplete="organization"
                    className={fieldClass(errors.company)}
                  />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input
                    value={form.email}
                    onChange={(event) => set('email', event.target.value)}
                    inputMode="email"
                    autoComplete="email"
                    className={fieldClass(errors.email)}
                  />
                </Field>
                <Field label="What do you need?" error={errors.requirement} className="sm:col-span-2">
                  <textarea
                    rows={3}
                    value={form.requirement}
                    onChange={(event) => set('requirement', event.target.value)}
                    placeholder="e.g. RCC chambers for a drainage line, 600 mm"
                    className={fieldClass(errors.requirement)}
                  />
                </Field>
              </div>

              {/* Honeypot */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={(event) => set('website', event.target.value)}
                className="hidden"
              />

              <div className="mt-5 space-y-3 border-t border-concrete-200 pt-4">
                <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-charcoal">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(event) => set('consent', event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    I agree to be contacted about this requirement by phone, WhatsApp or email.
                    <span className="text-terracotta"> *</span>
                    {errors.consent && (
                      <span className="mt-1 block text-[12.5px] text-terracotta-700">
                        {errors.consent}
                      </span>
                    )}
                  </span>
                </label>

                {/* Marketing consent is deliberately separate and optional. */}
                <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-concrete-700">
                  <input
                    type="checkbox"
                    checked={form.marketingConsent}
                    onChange={(event) => set('marketingConsent', event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    Optional: also send me occasional updates about products and offers. You can ask
                    us to stop at any time.
                  </span>
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                {otpAvailable && (
                  <Button
                    variant="accent"
                    size="lg"
                    block
                    onClick={() => {
                      if (validate()) setVerifying(true)
                    }}
                  >
                    Verify number &amp; continue
                  </Button>
                )}
                <Button type="submit" variant={otpAvailable ? 'outline' : 'accent'} size="lg" block disabled={busy}>
                  {busy ? 'Saving…' : otpAvailable ? 'Send without verifying' : 'Send my details'}
                </Button>
              </div>

              <button
                type="button"
                onClick={dismiss}
                className="mt-4 block w-full rounded-sm text-center text-[13px] text-concrete-700 underline-offset-4 hover:underline"
              >
                Maybe later — just let me browse
              </button>
            </form>
          )}
        </div>
      </div>

      {verifying && (
        <OtpDialog
          phone={form.phone}
          purpose="WELCOME"
          profile={{
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            company: form.company.trim() || undefined,
            marketingConsent: form.marketingConsent,
          }}
          description="Confirm your number and we will save your requirement and sign you in, so you will not need to verify again."
          onCancel={() => setVerifying(false)}
          onVerified={() => {
            setVerifying(false)
            void saveLead(true)
          }}
        />
      )}
    </>
  )
}

function fieldClass(error?: string) {
  return cn(
    'w-full rounded-sm border bg-cream px-3 py-2.5 text-[15px] text-charcoal',
    error ? 'border-terracotta' : 'border-concrete-300',
  )
}

function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-charcoal">
        {label}
        {required ? (
          <span className="text-terracotta"> *</span>
        ) : (
          <span className="font-normal text-concrete"> (optional)</span>
        )}
      </span>
      {children}
      {error && <span className="mt-1 block text-[12.5px] text-terracotta-700">{error}</span>}
    </label>
  )
}
