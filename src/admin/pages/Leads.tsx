import { CircleAlert, ShieldCheck, ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { PageTitle } from '../components/AdminLayout'
import {
  AdminPanel,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  formatDateTime,
  inputClass,
} from '../components/ui'

interface Lead {
  id: string
  name: string
  phone: string
  company: string | null
  email: string | null
  requirement: string | null
  source: string
  isPhoneVerified: boolean
  marketingConsent: boolean
  hasAccount: boolean
  createdAt: string
}

interface ListResponse {
  items: Lead[]
  pagination: { page: number; perPage: number; total: number; totalPages: number }
  verifiedCounts: { verified: number; unverified: number }
  sources: { source: string; count: number }[]
}

/**
 * Welcome-modal leads.
 *
 * Verification status is the first thing shown on each row: an unverified
 * lead is a number nobody has proved, and the team should treat it with more
 * caution than an enquiry, which cannot exist without verification.
 */
export default function AdminLeads() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<ListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(params.get('search') ?? '')

  const page = Number(params.get('page') ?? '1')
  const verified = params.get('verified') ?? ''
  const activeSearch = params.get('search') ?? ''

  const load = useCallback(async () => {
    setError(null)
    try {
      const query = new URLSearchParams({ page: String(page) })
      if (verified) query.set('verified', verified)
      if (activeSearch) query.set('search', activeSearch)
      setData(await api.get<ListResponse>(`/api/admin/leads?${query}`))
    } catch (caught) {
      setError((caught as Error).message)
    }
  }, [page, verified, activeSearch])

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

  return (
    <>
      <PageTitle
        title="Leads"
        description="Details captured by the welcome modal. Unlike enquiries, a lead can be saved without phone verification — check the badge before relying on the number."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 border border-concrete-200 bg-cream-100 p-4">
        <form
          className="flex min-w-[220px] flex-1 items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setParam('search', search.trim())
          }}
        >
          <label className="flex-1">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-concrete">
              Search
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, phone, company or requirement"
              className={inputClass}
            />
          </label>
        </form>

        <label>
          <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-concrete">
            Phone verified
          </span>
          <select
            value={verified}
            onChange={(event) => setParam('verified', event.target.value)}
            className={inputClass}
          >
            <option value="">All leads</option>
            <option value="true">Verified only</option>
            <option value="false">Unverified only</option>
          </select>
        </label>
      </div>

      {data && (
        <p className="mb-4 text-[13px] text-concrete-700">
          {data.verifiedCounts.verified} verified · {data.verifiedCounts.unverified} unverified
        </p>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !data && <LoadingState label="Loading leads" />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No leads yet"
          description="Details submitted through the welcome modal will appear here."
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.items.map((lead) => (
              <li key={lead.id}>
                <AdminPanel>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {lead.isPhoneVerified ? (
                          <span className="inline-flex items-center gap-1.5 rounded-sm border border-moss/30 bg-moss-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-moss-700">
                            <ShieldCheck aria-hidden="true" className="h-3 w-3" />
                            Phone verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-sm border border-terracotta/30 bg-terracotta-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-terracotta-700">
                            <ShieldAlert aria-hidden="true" className="h-3 w-3" />
                            Not verified
                          </span>
                        )}
                        <span className="rounded-sm border border-concrete-300 bg-cream-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-concrete-700">
                          {lead.source}
                        </span>
                        {lead.marketingConsent && (
                          <span className="rounded-sm border border-concrete-300 bg-cream-200 px-2 py-0.5 text-[11px] text-concrete-700">
                            opted in to updates
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm font-semibold text-charcoal">
                        {lead.name}
                        {lead.company ? ` · ${lead.company}` : ''}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-4 text-[13px] text-concrete-700">
                        <a href={`tel:${lead.phone}`} className="hover:text-charcoal">
                          {lead.phone}
                        </a>
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} className="hover:text-charcoal">
                            {lead.email}
                          </a>
                        )}
                      </p>
                      {lead.requirement && (
                        <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-charcoal-600">
                          {lead.requirement}
                        </p>
                      )}
                      <p className="mt-2 text-[12px] text-concrete">
                        {formatDateTime(lead.createdAt)}
                        {lead.hasAccount && ' · has a signed-in account'}
                      </p>
                    </div>
                  </div>

                  {!lead.isPhoneVerified && (
                    <p className="mt-3 flex items-start gap-2 border-t border-concrete-200 pt-3 text-[12.5px] leading-relaxed text-concrete-700">
                      <CircleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-concrete" />
                      This number has not been confirmed by SMS, so treat it as unverified until you
                      reach the person.
                    </p>
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
