import { CircleAlert, Info, Loader, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useFocusTrap } from '../../lib/useFocusTrap'

/**
 * Admin UI kit.
 *
 * Uses the same palette and type as the public site so the panel feels like
 * part of the business, but is tuned for dense, repetitive operational work:
 * compact rows, obvious status, and explicit confirmation before anything
 * destructive.
 */

/* ------------------------------------------------------------- Feedback */

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const ToastContext = createContext<{ push: (kind: ToastKind, message: string) => void } | null>(
  null,
)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, kind, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 6000)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-sm border px-4 py-3 text-sm shadow-lift',
              toast.kind === 'success' && 'border-moss/30 bg-moss-100 text-moss-700',
              toast.kind === 'error' && 'border-terracotta/40 bg-terracotta-100 text-terracotta-700',
              toast.kind === 'info' && 'border-concrete-300 bg-cream-100 text-charcoal',
            )}
          >
            {toast.kind === 'error' ? (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
              aria-label="Dismiss"
              className="rounded-sm p-0.5 opacity-60 hover:opacity-100"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}

/* ------------------------------------------------------------- Primitives */

export function AdminButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled,
  busy,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  disabled?: boolean
  busy?: boolean
  className?: string
}) {
  const variants = {
    primary: 'bg-charcoal text-cream hover:bg-charcoal-700',
    secondary: 'border border-concrete-300 bg-cream-100 text-charcoal hover:border-charcoal/40',
    danger: 'bg-terracotta text-white hover:bg-terracotta-600',
    ghost: 'text-charcoal-600 hover:bg-charcoal/5',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        size === 'sm' ? 'min-h-[34px] px-3 text-[13px]' : 'min-h-[40px] px-4 text-sm',
        variants[variant],
        className,
      )}
    >
      {busy && <Loader aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  )
}

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: 'border-moss/30 bg-moss-100 text-moss-700',
  DRAFT: 'border-concrete-300 bg-cream-200 text-concrete-700',
  IN_REVIEW: 'border-terracotta/30 bg-terracotta-100 text-terracotta-700',
  CHANGES_REQUESTED: 'border-terracotta/30 bg-terracotta-100 text-terracotta-700',
  ARCHIVED: 'border-charcoal/20 bg-charcoal/5 text-charcoal-600',
  PENDING: 'border-terracotta/30 bg-terracotta-100 text-terracotta-700',
  APPROVED: 'border-moss/30 bg-moss-100 text-moss-700',
  REJECTED: 'border-charcoal/20 bg-charcoal/5 text-charcoal-600',
  HIDDEN: 'border-charcoal/20 bg-charcoal/5 text-charcoal-600',
  NEW: 'border-terracotta/30 bg-terracotta-100 text-terracotta-700',
  CONTACTED: 'border-concrete-300 bg-cream-200 text-concrete-700',
  QUOTED: 'border-concrete-300 bg-cream-200 text-concrete-700',
  WON: 'border-moss/30 bg-moss-100 text-moss-700',
  LOST: 'border-charcoal/20 bg-charcoal/5 text-charcoal-600',
  CLOSED: 'border-charcoal/20 bg-charcoal/5 text-charcoal-600',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]',
        STATUS_STYLES[status] ?? 'border-concrete-300 bg-cream-200 text-concrete-700',
      )}
    >
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  )
}

export function AdminPanel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('border border-concrete-200 bg-cream-100', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-concrete-200 px-5 py-4">
          <div>
            {title && <h2 className="text-base">{title}</h2>}
            {description && (
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-concrete-700">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------- States */

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-10 text-sm text-concrete-700" role="status">
      <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
      {label}…
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-terracotta/40 bg-terracotta-100 p-5" role="alert">
      <p className="flex items-start gap-2 text-sm text-charcoal">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-700" />
        {message}
      </p>
      {onRetry && (
        <AdminButton variant="secondary" size="sm" onClick={onRetry} className="mt-3">
          Try again
        </AdminButton>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="border border-dashed border-concrete-300 bg-cream px-6 py-12 text-center">
      <h3 className="text-base">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-concrete-700">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/* ---------------------------------------------------------- Confirmation */

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  destructive?: boolean
  /** When set, the admin must type a reason before confirming. */
  requireReason?: boolean
}

/**
 * Promise-based confirmation. Every destructive or publishing action routes
 * through this, so nothing irreversible happens on a single stray click.
 */
export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return context.confirm
}

const ConfirmContext = createContext<{
  confirm: (options: ConfirmOptions) => Promise<{ ok: boolean; reason?: string }>
} | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (value: { ok: boolean; reason?: string }) => void }) | null
  >(null)
  const [reason, setReason] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  // Destructive confirmations must not be dismissible by tabbing past them
  // into the page behind and hitting Enter on something else.
  useFocusTrap(dialogRef, state !== null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<{ ok: boolean; reason?: string }>((resolve) => {
        setReason('')
        setState({ ...options, resolve })
      }),
    [],
  )

  const close = (ok: boolean) => {
    state?.resolve({ ok, reason: reason.trim() || undefined })
    setState(null)
  }

  useEffect(() => {
    if (!state) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reason])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-charcoal/50 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-md border border-concrete-300 bg-cream-100 p-6 shadow-lift"
          >
            <h2 id="confirm-title" className="text-lg">
              {state.title}
            </h2>
            <div className="mt-2 text-[14px] leading-relaxed text-concrete-700">{state.message}</div>

            {state.requireReason && (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[13px] font-semibold text-charcoal">
                  Reason (recorded internally)
                </span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-sm border border-concrete-300 bg-cream px-3 py-2 text-sm"
                />
              </label>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <AdminButton variant="secondary" onClick={() => close(false)}>
                Cancel
              </AdminButton>
              <AdminButton
                variant={state.destructive ? 'danger' : 'primary'}
                disabled={state.requireReason && reason.trim().length === 0}
                onClick={() => close(true)}
              >
                {state.confirmLabel ?? 'Confirm'}
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

/* -------------------------------------------------------------- Inputs */

export function Labelled({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-semibold text-charcoal">
        {label}
        {required && (
          <span aria-hidden="true" className="text-terracotta">
            *
          </span>
        )}
        {hint && <span className="font-normal text-concrete">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-[12.5px] text-terracotta-700">{error}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-sm border border-concrete-300 bg-cream px-3 py-2 text-sm text-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-1'

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) {
    return <p className="text-[13px] text-concrete">{total} item{total === 1 ? '' : 's'}</p>
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[13px] text-concrete">
        Page {page} of {totalPages} · {total} item{total === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <AdminButton size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </AdminButton>
        <AdminButton
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </AdminButton>
      </div>
    </div>
  )
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
