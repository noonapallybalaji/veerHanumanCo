import { CircleAlert, Loader, ShieldCheck, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiRequestError, api } from '../lib/api'
import { cn } from '../lib/cn'
import { useFocusTrap } from '../lib/useFocusTrap'
import { Button } from '../components/ui/Button'
import { useVisitor, type Visitor } from './VisitorContext'

/**
 * Phone verification step.
 *
 * Used by the welcome modal and by every enquiry form. It only reports the
 * outcome — the server issues the session cookie, and the enquiry endpoint
 * checks that cookie independently, so this component cannot "approve" a
 * submission on its own.
 *
 * The caller keeps its form state mounted while this runs, so nothing the
 * visitor typed is lost during verification.
 */

interface OtpDialogProps {
  phone: string
  purpose: 'WELCOME' | 'ENQUIRY' | 'LOGIN'
  /** Sent with the verification so a new account starts with real details. */
  profile?: { name?: string; email?: string; company?: string; marketingConsent?: boolean }
  title?: string
  description?: string
  onVerified: (visitor: Visitor) => void
  onCancel: () => void
}

export function OtpDialog({
  phone,
  purpose,
  profile,
  title = 'Verify your mobile number',
  description,
  onVerified,
  onCancel,
}: OtpDialogProps) {
  const { capability, setVisitor } = useVisitor()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'sending' | 'entering' | 'verifying'>('sending')
  const [error, setError] = useState<string | null>(null)
  const [normalisedPhone, setNormalisedPhone] = useState(phone)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const otpLength = capability?.otpLength ?? 6

  const send = useCallback(async () => {
    setStatus('sending')
    setError(null)
    try {
      const response = await api.post<{ phone: string; resendInSeconds: number }>(
        '/api/visitor/otp/request',
        { phone, purpose },
      )
      setNormalisedPhone(response.phone)
      setCooldown(response.resendInSeconds ?? 45)
      setStatus('entering')
      window.setTimeout(() => inputRef.current?.focus(), 50)
    } catch (caught) {
      setStatus('entering')
      if (caught instanceof ApiRequestError) {
        setError(caught.message)
        const retry = (caught.details as { retryInSeconds?: number })?.retryInSeconds
        if (retry) setCooldown(retry)
      } else {
        setError('We could not reach the server. Please check your connection and try again.')
      }
    }
  }, [phone, purpose])

  // Request the first code as soon as the dialog opens.
  useEffect(() => {
    void send()
  }, [send])

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  // Keeps Tab inside the dialog. The initial focus lands on the close button
  // while the code is being sent; `send` moves it to the input once it exists.
  useFocusTrap(dialogRef, true)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  async function verify(event?: React.FormEvent) {
    event?.preventDefault()
    if (code.trim().length < 4) {
      setError('Enter the code we sent you.')
      return
    }

    setStatus('verifying')
    setError(null)
    try {
      const response = await api.post<{ customer: Visitor }>('/api/visitor/otp/verify', {
        phone: normalisedPhone,
        code: code.trim(),
        ...profile,
      })
      setVisitor(response.customer)
      onVerified(response.customer)
    } catch (caught) {
      setStatus('entering')
      setCode('')
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : 'We could not check that code. Please try again.',
      )
      window.setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-charcoal/60 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="otp-title"
        className="w-full max-w-md border border-concrete-200 bg-cream-100 p-6 shadow-lift sm:rounded-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-terracotta-100 text-terracotta"
            >
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <h2 id="otp-title" className="text-lg leading-snug">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel verification"
            className="rounded-sm p-1 text-concrete hover:text-charcoal"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-[14px] leading-relaxed text-concrete-700">
          {description ??
            'We need to confirm your number before we can accept this. Enter the code we just sent by SMS.'}
        </p>
        <p className="mt-1 text-[14px] font-semibold text-charcoal">{normalisedPhone}</p>

        {status === 'sending' && (
          <p className="mt-5 flex items-center gap-2 text-sm text-concrete-700">
            <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
            Sending your code…
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 border border-terracotta/40 bg-terracotta-100 p-3 text-[13px] text-charcoal"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-700" />
            {error}
          </p>
        )}

        {status !== 'sending' && (
          <form onSubmit={verify} className="mt-5">
            <label htmlFor="otp-code" className="mb-1.5 block text-[13px] font-semibold text-charcoal">
              Verification code
            </label>
            <input
              id="otp-code"
              ref={inputRef}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^\d]/g, '').slice(0, otpLength))}
              inputMode="numeric"
              autoComplete="one-time-code"
              // Lets mobile browsers offer the SMS code automatically.
              pattern="\d*"
              maxLength={otpLength}
              placeholder={'0'.repeat(otpLength)}
              className={cn(
                'w-full rounded-sm border bg-cream px-3.5 py-3 text-center font-mono text-[22px] tracking-[0.5em] text-charcoal',
                error ? 'border-terracotta' : 'border-concrete-300',
              )}
            />

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <Button
                type="submit"
                variant="accent"
                size="lg"
                block
                disabled={status === 'verifying' || code.length < 4}
              >
                {status === 'verifying' ? 'Checking…' : 'Verify & continue'}
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-[13px]">
              <button
                type="button"
                onClick={send}
                disabled={cooldown > 0 || status === 'verifying'}
                className="rounded-sm font-semibold text-terracotta underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-concrete disabled:no-underline"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-sm text-concrete-700 underline-offset-4 hover:underline"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
