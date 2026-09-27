import { Check, CircleAlert, Flag, Loader, Star } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ApiRequestError, api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'

/**
 * Customer reviews on a product page.
 *
 * Only approved reviews are ever returned by the API, so there is no
 * client-side filtering to get wrong. A submitted review goes into the
 * moderation queue and the form says so plainly rather than implying it is
 * already live.
 *
 * When a product has no published reviews the block shows a neutral empty
 * state. It never displays a fabricated average or a "verified purchase"
 * badge, because there is no purchase verification behind it.
 */

interface Review {
  id: string
  displayName: string
  rating: number
  title: string | null
  body: string
  companyName: string | null
  useContext: string | null
  submittedAt: string
}

interface ReviewsResponse {
  items: Review[]
  pagination: { page: number; perPage: number; total: number; totalPages: number }
  summary: { average: number | null; count: number }
}

export function ProductReviews({ productSlug, productName }: { productSlug: string; productName: string }) {
  const [data, setData] = useState<ReviewsResponse | null>(null)
  const [page, setPage] = useState(1)
  const [failed, setFailed] = useState(false)
  const [writing, setWriting] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(
        await api.get<ReviewsResponse>(`/api/public/products/${productSlug}/reviews?page=${page}`),
      )
      setFailed(false)
    } catch {
      // Reviews are supplementary: if the API is unreachable the rest of the
      // product page must still be usable, so this fails quietly.
      setFailed(true)
    }
  }, [productSlug, page])

  useEffect(() => {
    void load()
  }, [load])

  if (failed) return null

  const summary = data?.summary
  const hasReviews = (summary?.count ?? 0) > 0

  return (
    <section id="reviews" className="border-t border-concrete-200 bg-cream py-14 lg:py-16">
      <div className="shell">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-4">Customer reviews</p>
            <h2 className="text-[26px] leading-tight sm:text-[32px]">
              What customers say about {productName}
            </h2>
            {hasReviews && summary?.average != null && (
              <p className="mt-3 flex flex-wrap items-center gap-2.5 text-sm text-concrete-700">
                <Stars rating={Math.round(summary.average)} />
                <span className="font-semibold text-charcoal">{summary.average.toFixed(1)} out of 5</span>
                <span>
                  from {summary.count} published review{summary.count === 1 ? '' : 's'}
                </span>
              </p>
            )}
          </div>
          {!writing && (
            <Button variant="outline" size="md" onClick={() => setWriting(true)}>
              Write a review
            </Button>
          )}
        </div>

        {writing && (
          <ReviewForm
            productSlug={productSlug}
            onClose={() => setWriting(false)}
            onSubmitted={() => {
              setWriting(false)
              void load()
            }}
          />
        )}

        {!data && !writing && (
          <p className="flex items-center gap-2 text-sm text-concrete-700">
            <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
            Loading reviews…
          </p>
        )}

        {data && !hasReviews && !writing && (
          <div className="border border-concrete-200 bg-cream-100 p-6">
            <h3 className="text-base">No reviews yet</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-concrete-700">
              This product has not been reviewed yet. If you have used it on a project, your
              feedback would help other buyers. Reviews are checked before they appear.
            </p>
          </div>
        )}

        {data && hasReviews && (
          <>
            <ul className="grid gap-4 sm:grid-cols-2">
              {data.items.map((review) => (
                <li key={review.id}>
                  <article className="flex h-full flex-col border border-concrete-200 bg-cream-100 p-5">
                    <Stars rating={review.rating} />
                    {review.title && (
                      <h3 className="mt-3 text-base leading-snug">{review.title}</h3>
                    )}
                    <p className="mt-2 flex-1 whitespace-pre-line text-[14.5px] leading-relaxed text-charcoal-600">
                      {review.body}
                    </p>
                    <footer className="mt-4 border-t border-concrete-200 pt-3">
                      <p className="text-[13px] font-semibold text-charcoal">
                        {review.displayName}
                        {review.companyName && (
                          <span className="font-normal text-concrete-700"> · {review.companyName}</span>
                        )}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-concrete">
                        <span>
                          {new Date(review.submittedAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {review.useContext && <span>{review.useContext}</span>}
                        <ReportButton reviewId={review.id} />
                      </p>
                    </footer>
                  </article>
                </li>
              ))}
            </ul>

            {data.pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between gap-3">
                <p className="text-[13px] text-concrete">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((current) => Math.min(data.pagination.totalPages, current + 1))
                    }
                  >
                    Load more
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          className={cn(
            'h-4 w-4',
            value <= rating ? 'fill-terracotta text-terracotta' : 'text-concrete-300',
          )}
        />
      ))}
    </span>
  )
}

function ReportButton({ reviewId }: { reviewId: string }) {
  const [done, setDone] = useState(false)

  async function report() {
    const reason = window.prompt('What is wrong with this review?')
    if (!reason?.trim()) return
    try {
      await api.post(`/api/public/reviews/${reviewId}/report`, { reason: reason.trim() })
      setDone(true)
    } catch {
      setDone(true) // Do not reveal whether the report registered.
    }
  }

  if (done) return <span className="text-concrete">Reported — thank you</span>

  return (
    <button
      type="button"
      onClick={report}
      className="inline-flex items-center gap-1 rounded-sm underline-offset-2 hover:text-charcoal hover:underline"
    >
      <Flag aria-hidden="true" className="h-3 w-3" />
      Report
    </button>
  )
}

/* ---------------------------------------------------------------- Form */

function ReviewForm({
  productSlug,
  onClose,
  onSubmitted,
}: {
  productSlug: string
  onClose: () => void
  onSubmitted: () => void
}) {
  const [form, setForm] = useState({
    displayName: '',
    rating: 0,
    title: '',
    body: '',
    companyName: '',
    useContext: '',
    consent: false,
    website: '', // honeypot
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const [message, setMessage] = useState('')

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()

    const next: Record<string, string> = {}
    if (form.displayName.trim().length < 2) next.displayName = 'Please enter your name.'
    if (form.rating < 1) next.rating = 'Choose a rating.'
    if (form.body.trim().length < 20) next.body = 'Please write at least a sentence or two.'
    if (!form.consent) next.consent = 'Please confirm you understand reviews are checked first.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setStatus('sending')
    try {
      await api.post(`/api/public/products/${productSlug}/reviews`, form)
      setStatus('done')
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors)
        setMessage(error.message)
      } else {
        setMessage('We could not send your review just now. Please try again shortly.')
      }
      setStatus('failed')
    }
  }

  if (status === 'done') {
    return (
      <div className="mb-8 border border-moss/30 bg-moss-100 p-6" role="status">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-sm bg-moss text-white"
        >
          <Check className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-lg">Thank you</h3>
        <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-charcoal-600">
          Your review has been received. Every review is read before it goes on the site, so it will
          appear here once it has been checked.
        </p>
        <Button variant="outline" size="md" className="mt-5" onClick={onSubmitted}>
          Close
        </Button>
      </div>
    )
  }

  const field = 'w-full rounded-sm border bg-cream-100 px-3.5 py-2.5 text-[15px] text-charcoal'

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mb-8 border border-concrete-200 bg-cream-100 p-5 sm:p-6"
    >
      <h3 className="text-lg">Write a review</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-concrete-700">
        Reviews are checked before publishing. Please do not include personal contact details or
        pricing.
      </p>

      {status === 'failed' && message && (
        <p className="mt-4 flex items-start gap-2 border border-terracotta/40 bg-terracotta-100 p-3 text-[13px] text-charcoal">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-700" />
          {message}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-[13px] font-semibold text-charcoal">
            Your rating <span className="text-terracotta">*</span>
          </legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => set('rating', value)}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                aria-pressed={form.rating === value}
                className="rounded-sm p-1"
              >
                <Star
                  aria-hidden="true"
                  className={cn(
                    'h-7 w-7 transition-colors',
                    value <= form.rating
                      ? 'fill-terracotta text-terracotta'
                      : 'text-concrete-300 hover:text-concrete',
                  )}
                />
              </button>
            ))}
          </div>
          {errors.rating && (
            <p className="mt-1 text-[12.5px] text-terracotta-700">{errors.rating}</p>
          )}
        </fieldset>

        <label>
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal">
            Your name <span className="text-terracotta">*</span>
          </span>
          <input
            value={form.displayName}
            onChange={(event) => set('displayName', event.target.value)}
            className={cn(field, errors.displayName ? 'border-terracotta' : 'border-concrete-300')}
          />
          {errors.displayName && (
            <span className="mt-1 block text-[12.5px] text-terracotta-700">{errors.displayName}</span>
          )}
        </label>

        <label>
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal">
            Company <span className="font-normal text-concrete">(optional)</span>
          </span>
          <input
            value={form.companyName}
            onChange={(event) => set('companyName', event.target.value)}
            className={cn(field, 'border-concrete-300')}
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal">
            Headline <span className="font-normal text-concrete">(optional)</span>
          </span>
          <input
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            className={cn(field, 'border-concrete-300')}
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal">
            Your review <span className="text-terracotta">*</span>
          </span>
          <textarea
            rows={5}
            value={form.body}
            onChange={(event) => set('body', event.target.value)}
            placeholder="How did the product perform on your site?"
            className={cn(field, errors.body ? 'border-terracotta' : 'border-concrete-300')}
          />
          {errors.body && (
            <span className="mt-1 block text-[12.5px] text-terracotta-700">{errors.body}</span>
          )}
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal">
            Where you used it <span className="font-normal text-concrete">(optional)</span>
          </span>
          <input
            value={form.useContext}
            onChange={(event) => set('useContext', event.target.value)}
            placeholder="e.g. Storm water drainage, Hyderabad"
            className={cn(field, 'border-concrete-300')}
          />
        </label>

        {/* Honeypot: hidden from people, tempting to naive bots. */}
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
      </div>

      <label className="mt-5 flex items-start gap-2.5 text-[13.5px] leading-relaxed text-charcoal">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(event) => set('consent', event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          I understand this review will be checked before it is published, and that my display name
          and company may be shown alongside it.
          {errors.consent && (
            <span className="mt-1 block text-[12.5px] text-terracotta-700">{errors.consent}</span>
          )}
        </span>
      </label>

      <div className="mt-6 flex flex-col gap-2.5 border-t border-concrete-200 pt-5 sm:flex-row">
        <Button type="submit" variant="accent" size="lg" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Submit review'}
        </Button>
        <Button variant="outline" size="lg" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
