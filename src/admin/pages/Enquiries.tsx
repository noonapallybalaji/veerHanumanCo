import { Download, Mail, Phone, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, apiUrl } from '../../lib/api'
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
  inputClass,
  useToast,
} from '../components/ui'

const STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST', 'CLOSED']

interface EnquiryItem {
  id: string
  productName: string
  quantity: string | null
  specification: string | null
}

interface Enquiry {
  id: string
  name: string
  company: string | null
  phone: string
  whatsapp: string | null
  email: string | null
  projectType: string | null
  deliveryLocation: string | null
  requirementDate: string | null
  notes: string | null
  status: string
  source: string | null
  /** Set by the server when the phone was proved by OTP at submission. */
  phoneVerified: boolean
  createdAt: string
  items: EnquiryItem[]
  adminNotes: { id: string; body: string; createdAt: string; author: { name: string } | null }[]
}

interface ListResponse {
  items: Enquiry[]
  pagination: { page: number; perPage: number; total: number; totalPages: number }
  statusCounts: Record<string, number>
}

/**
 * Lead management. Enquiries hold customer contact details, so this view is
 * admin-only and nothing here is echoed to a public endpoint.
 */
export default function AdminEnquiries() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<ListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const { can } = useAuth()
  const { push } = useToast()

  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? '1')

  const load = useCallback(async () => {
    setError(null)
    try {
      const query = new URLSearchParams({ page: String(page) })
      if (status) query.set('status', status)
      setData(await api.get<ListResponse>(`/api/admin/enquiries?${query}`))
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

  async function changeStatus(enquiry: Enquiry, nextStatus: string) {
    try {
      await api.put(`/api/admin/enquiries/${enquiry.id}/status`, { status: nextStatus })
      push('success', `Marked ${nextStatus.toLowerCase()}.`)
      await load()
    } catch (caught) {
      push('error', (caught as Error).message)
    }
  }

  async function addNote(enquiry: Enquiry) {
    if (!noteDraft.trim()) return
    try {
      await api.post(`/api/admin/enquiries/${enquiry.id}/notes`, { body: noteDraft.trim() })
      setNoteDraft('')
      push('success', 'Note added.')
      await load()
    } catch (caught) {
      push('error', (caught as Error).message)
    }
  }

  return (
    <>
      <PageTitle
        title="Enquiries"
        description="Requirements submitted through the website. Customer details are never shown publicly."
        actions={
          <a
            href={apiUrl(`/api/admin/enquiries/export.csv${status ? `?status=${status}` : ''}`)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-sm border border-concrete-300 bg-cream-100 px-4 text-sm font-semibold text-charcoal hover:border-charcoal/40"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-concrete-200 pb-3">
        {[{ value: '', label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: s.toLowerCase() }))].map(
          (tab) => {
            const count = tab.value ? data?.statusCounts?.[tab.value] : undefined
            const active = status === tab.value
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setParam('status', tab.value)}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-sm px-3 text-[13px] font-semibold capitalize transition-colors ${
                  active ? 'bg-charcoal text-cream' : 'text-concrete-700 hover:bg-charcoal/5'
                }`}
              >
                {tab.label}
                {typeof count === 'number' && count > 0 && (
                  <span className={active ? 'text-cream/60' : 'text-concrete'}>{count}</span>
                )}
              </button>
            )
          },
        )}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !data && <LoadingState label="Loading enquiries" />}
      {data && data.items.length === 0 && (
        <EmptyState
          title="No enquiries yet"
          description="Requirements submitted through the quote form and contact page will appear here."
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.items.map((enquiry) => {
              const open = openId === enquiry.id
              return (
                <li key={enquiry.id}>
                  <AdminPanel>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11.5px] text-concrete">
                            {enquiry.id.slice(-8).toUpperCase()}
                          </span>
                          <StatusBadge status={enquiry.status} />
                          {enquiry.phoneVerified ? (
                            <span className="inline-flex items-center gap-1.5 rounded-sm border border-moss/30 bg-moss-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-moss-700">
                              <ShieldCheck aria-hidden="true" className="h-3 w-3" />
                              Phone verified
                            </span>
                          ) : (
                            // Only possible on rows predating mandatory OTP.
                            <span className="rounded-sm border border-concrete-300 bg-cream-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-concrete-700">
                              Unverified (legacy)
                            </span>
                          )}
                          {enquiry.source && (
                            <span className="rounded-sm border border-concrete-300 bg-cream-200 px-2 py-0.5 text-[11px] text-concrete-700">
                              via {enquiry.source}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-charcoal">
                          {enquiry.name}
                          {enquiry.company ? ` · ${enquiry.company}` : ''}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-concrete-700">
                          <a href={`tel:${enquiry.phone}`} className="inline-flex items-center gap-1.5 hover:text-charcoal">
                            <Phone aria-hidden="true" className="h-3.5 w-3.5" />
                            {enquiry.phone}
                          </a>
                          {enquiry.email && (
                            <a href={`mailto:${enquiry.email}`} className="inline-flex items-center gap-1.5 hover:text-charcoal">
                              <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                              {enquiry.email}
                            </a>
                          )}
                        </p>
                        <p className="mt-1 text-[12.5px] text-concrete">
                          {formatDateTime(enquiry.createdAt)}
                          {enquiry.deliveryLocation ? ` · ${enquiry.deliveryLocation}` : ''}
                          {enquiry.projectType ? ` · ${enquiry.projectType}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {can('enquiry:write') && (
                          <select
                            value={enquiry.status}
                            onChange={(event) => changeStatus(enquiry, event.target.value)}
                            aria-label={`Status for enquiry ${enquiry.id.slice(-8)}`}
                            className={`${inputClass} w-auto`}
                          >
                            {STATUSES.map((value) => (
                              <option key={value} value={value}>
                                {value.toLowerCase()}
                              </option>
                            ))}
                          </select>
                        )}
                        <AdminButton
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setOpenId(open ? null : enquiry.id)
                            setNoteDraft('')
                          }}
                        >
                          {open ? 'Hide' : 'Details'}
                        </AdminButton>
                      </div>
                    </div>

                    {open && (
                      <div className="mt-4 space-y-4 border-t border-concrete-200 pt-4">
                        {enquiry.items.length > 0 && (
                          <div>
                            <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-concrete">
                              Requirement
                            </h3>
                            <ul className="mt-2 space-y-1">
                              {enquiry.items.map((item) => (
                                <li key={item.id} className="text-[13.5px] text-charcoal">
                                  {item.productName}
                                  {item.quantity ? ` — ${item.quantity}` : ''}
                                  {item.specification ? ` (${item.specification})` : ''}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {enquiry.notes && (
                          <div>
                            <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-concrete">
                              Customer notes
                            </h3>
                            <p className="mt-1.5 whitespace-pre-line text-[13.5px] text-charcoal-600">
                              {enquiry.notes}
                            </p>
                          </div>
                        )}

                        <div>
                          <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-concrete">
                            Internal notes
                          </h3>
                          {enquiry.adminNotes.length > 0 && (
                            <ul className="mt-2 space-y-2">
                              {enquiry.adminNotes.map((note) => (
                                <li key={note.id} className="border-l-2 border-concrete-300 pl-3">
                                  <p className="text-[13.5px] text-charcoal">{note.body}</p>
                                  <p className="mt-0.5 text-[11.5px] text-concrete">
                                    {note.author?.name ?? 'Unknown'} · {formatDateTime(note.createdAt)}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                          {can('enquiry:write') && (
                            <div className="mt-3 flex gap-2">
                              <input
                                value={noteDraft}
                                onChange={(event) => setNoteDraft(event.target.value)}
                                placeholder="Add an internal note"
                                className={`${inputClass} flex-1`}
                              />
                              <AdminButton size="sm" onClick={() => addNote(enquiry)}>
                                Add
                              </AdminButton>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </AdminPanel>
                </li>
              )
            })}
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
