import { Star } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiRequestError, api } from '../../lib/api'
import { useAuth } from '../AuthContext'
import { PageTitle } from '../components/AdminLayout'
import {
  AdminButton,
  AdminPanel,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  StatusBadge,
  formatDateTime,
  useConfirm,
  useToast,
} from '../components/ui'

interface AdminReview {
  id: string
  productId: string
  productName: string | null
  displayName: string
  rating: number
  title: string | null
  body: string
  companyName: string | null
  useContext: string | null
  status: string
  internalReason: string | null
  submittedAt: string
  publishedAt: string | null
  openReports?: number
  events: { action: string; reason: string | null; at: string; actor: { name: string } | null }[]
}

interface ListResponse {
  items: AdminReview[]
  pagination: { page: number; perPage: number; total: number; totalPages: number }
  statusCounts: Record<string, number>
}

/**
 * Moderation queue.
 *
 * Nothing here can edit what a customer wrote — only its visibility, plus an
 * internal reason. Rejecting or hiding requires that reason, so every
 * decision is accountable and attributable in the history.
 */
export default function AdminReviews() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<ListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { can } = useAuth()
  const { push } = useToast()
  const confirm = useConfirm()

  const status = params.get('status') ?? 'PENDING'
  const page = Number(params.get('page') ?? '1')

  const load = useCallback(async () => {
    setError(null)
    try {
      const query = new URLSearchParams({ page: String(page) })
      if (status) query.set('status', status)
      setData(await api.get<ListResponse>(`/api/admin/reviews?${query}`))
    } catch (caught) {
      setError((caught as Error).message)
    }
  }, [page, status])

  useEffect(() => {
    void load()
  }, [load])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  async function moderate(review: AdminReview, action: 'approve' | 'reject' | 'hide' | 'restore') {
    const needsReason = action === 'reject' || action === 'hide'
    let reason: string | undefined

    if (needsReason) {
      const result = await confirm({
        title: action === 'reject' ? 'Reject this review?' : 'Hide this published review?',
        message: (
          <>
            This will not change what the customer wrote. Record why you are doing it — the note is
            internal and never shown publicly.
          </>
        ),
        confirmLabel: action === 'reject' ? 'Reject' : 'Hide',
        destructive: true,
        requireReason: true,
      })
      if (!result.ok) return
      reason = result.reason
    }

    setBusyId(review.id)
    try {
      await api.post(`/api/admin/reviews/${review.id}/${action}`, { reason })
      push('success', `Review ${action === 'approve' ? 'published' : `${action}ed`}.`)
      await load()
    } catch (caught) {
      push('error', caught instanceof ApiRequestError ? caught.message : 'That did not work.')
    } finally {
      setBusyId(null)
    }
  }

  const tabs = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Published' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'HIDDEN', label: 'Hidden' },
    { value: '', label: 'All' },
  ]

  return (
    <>
      <PageTitle
        title="Reviews"
        description="Customer reviews never appear on the website until they are approved here."
      />

      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-concrete-200 pb-3">
        {tabs.map((tab) => {
          const count = tab.value ? data?.statusCounts?.[tab.value] : undefined
          const active = status === tab.value
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => setParam('status', tab.value)}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-sm px-3 text-[13px] font-semibold transition-colors ${
                active
                  ? 'bg-charcoal text-cream'
                  : 'text-concrete-700 hover:bg-charcoal/5 hover:text-charcoal'
              }`}
            >
              {tab.label}
              {typeof count === 'number' && count > 0 && (
                <span className={active ? 'text-cream/60' : 'text-concrete'}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !data && <LoadingState label="Loading reviews" />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={status === 'PENDING' ? 'Nothing waiting for moderation' : 'No reviews here'}
          description={
            status === 'PENDING'
              ? 'New customer reviews will appear here for approval before they go live.'
              : 'Try another tab.'
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className="space-y-4">
            {data.items.map((review) => (
              <li key={review.id}>
                <AdminPanel className={busyId === review.id ? 'opacity-50' : undefined}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars rating={review.rating} />
                        <StatusBadge status={review.status} />
                        {(review.openReports ?? 0) > 0 && (
                          <span className="rounded-sm border border-terracotta/40 bg-terracotta-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-terracotta-700">
                            {review.openReports} report{review.openReports === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-charcoal">
                        {review.title || 'Untitled review'}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-charcoal-600">
                        {review.body}
                      </p>
                      <p className="mt-2.5 text-[12.5px] text-concrete">
                        {review.displayName}
                        {review.companyName ? ` · ${review.companyName}` : ''} ·{' '}
                        {review.productName ?? 'Unknown product'} ·{' '}
                        {formatDateTime(review.submittedAt)}
                      </p>
                      {review.useContext && (
                        <p className="mt-1 text-[12.5px] text-concrete">
                          Context: {review.useContext}
                        </p>
                      )}
                      {review.internalReason && (
                        <p className="mt-2 border-l-2 border-concrete-300 pl-3 text-[12.5px] italic text-concrete-700">
                          Internal note: {review.internalReason}
                        </p>
                      )}
                    </div>

                    {can('review:moderate') && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {review.status !== 'APPROVED' && (
                          <AdminButton size="sm" onClick={() => moderate(review, 'approve')}>
                            Approve &amp; publish
                          </AdminButton>
                        )}
                        {review.status === 'PENDING' && (
                          <AdminButton
                            size="sm"
                            variant="secondary"
                            onClick={() => moderate(review, 'reject')}
                          >
                            Reject
                          </AdminButton>
                        )}
                        {review.status === 'APPROVED' && (
                          <AdminButton
                            size="sm"
                            variant="secondary"
                            onClick={() => moderate(review, 'hide')}
                          >
                            Hide
                          </AdminButton>
                        )}
                        {(review.status === 'HIDDEN' || review.status === 'REJECTED') && (
                          <AdminButton
                            size="sm"
                            variant="secondary"
                            onClick={() => moderate(review, 'restore')}
                          >
                            Restore
                          </AdminButton>
                        )}
                      </div>
                    )}
                  </div>

                  {review.events.length > 0 && (
                    <details className="mt-4 border-t border-concrete-200 pt-3">
                      <summary className="cursor-pointer text-[12.5px] font-semibold text-concrete-700">
                        Moderation history ({review.events.length})
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {review.events.map((event, index) => (
                          <li key={index} className="text-[12.5px] text-concrete">
                            <span className="font-semibold text-charcoal-600">
                              {event.action.toLowerCase()}
                            </span>{' '}
                            · {formatDateTime(event.at)}
                            {event.actor ? ` · ${event.actor.name}` : ''}
                            {event.reason ? ` — ${event.reason}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </AdminPanel>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              onChange={(next) => setParam('page', String(next))}
            />
          </div>
        </>
      )}
    </>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          className={`h-3.5 w-3.5 ${
            value <= rating ? 'fill-terracotta text-terracotta' : 'text-concrete-300'
          }`}
        />
      ))}
    </span>
  )
}
