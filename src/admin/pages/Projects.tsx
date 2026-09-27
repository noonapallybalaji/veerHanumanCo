import { ArrowLeft, Info, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiRequestError, api } from '../../lib/api'
import { useAuth } from '../AuthContext'
import { PageTitle } from '../components/AdminLayout'
import { MediaPicker } from '../components/MediaPicker'
import {
  AdminButton,
  AdminPanel,
  EmptyState,
  ErrorState,
  Labelled,
  LoadingState,
  Pagination,
  StatusBadge,
  formatDateTime,
  inputClass,
  useConfirm,
  useToast,
} from '../components/ui'

interface ProjectRow {
  id: string
  title: string
  slug: string
  summary: string
  status: string
  featured: boolean
  location: string | null
  projectType: string | null
  year: number | null
  updatedAt: string
}

interface ListResponse {
  items: ProjectRow[]
  pagination: { page: number; perPage: number; total: number; totalPages: number }
}

export function AdminProjects() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<ListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { can } = useAuth()
  const { push } = useToast()
  const confirm = useConfirm()

  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? '1')

  const load = useCallback(async () => {
    setError(null)
    try {
      const query = new URLSearchParams({ page: String(page) })
      if (status) query.set('status', status)
      setData(await api.get<ListResponse>(`/api/admin/projects?${query}`))
    } catch (caught) {
      setError((caught as Error).message)
    }
  }, [page, status])

  useEffect(() => {
    void load()
  }, [load])

  async function transition(project: ProjectRow, action: string) {
    if (action === 'unpublish' || action === 'archive') {
      const result = await confirm({
        title: action === 'archive' ? 'Archive this project?' : 'Take this project offline?',
        message: `"${project.title}" will stop appearing on the website and in the sitemap.`,
        confirmLabel: action === 'archive' ? 'Archive' : 'Unpublish',
        destructive: true,
      })
      if (!result.ok) return
    }
    try {
      await api.post(`/api/admin/projects/${project.id}/${action}`)
      push('success', `Project ${action === 'publish' ? 'is now live' : `${action}ed`}.`)
      await load()
    } catch (caught) {
      push('error', (caught as Error).message)
    }
  }

  return (
    <>
      <PageTitle
        title="Projects"
        description="Delivered work published on the website. Only add references the client is happy to have mentioned."
        actions={
          can('content:write') && (
            <Link
              to="/admin/projects/new"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-sm bg-charcoal px-4 text-sm font-semibold text-cream hover:bg-charcoal-700"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              New project
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-concrete-200 pb-3">
        {[
          { value: '', label: 'All' },
          { value: 'PUBLISHED', label: 'Published' },
          { value: 'DRAFT', label: 'Draft' },
          { value: 'ARCHIVED', label: 'Archived' },
        ].map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params)
              if (tab.value) next.set('status', tab.value)
              else next.delete('status')
              next.delete('page')
              setParams(next, { replace: true })
            }}
            className={`inline-flex min-h-[36px] items-center rounded-sm px-3 text-[13px] font-semibold transition-colors ${
              status === tab.value ? 'bg-charcoal text-cream' : 'text-concrete-700 hover:bg-charcoal/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !data && <LoadingState label="Loading projects" />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="While this is empty the public projects page shows an honest 'portfolio in preparation' state instead of placeholder cards."
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.items.map((project) => (
              <li key={project.id}>
                <AdminPanel>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={project.status} />
                        {project.featured && (
                          <span className="rounded-sm border border-terracotta/30 bg-terracotta-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-terracotta-700">
                            Featured
                          </span>
                        )}
                      </div>
                      <Link
                        to={`/admin/projects/${project.id}`}
                        className="mt-1.5 block text-sm font-semibold text-charcoal hover:text-terracotta"
                      >
                        {project.title}
                      </Link>
                      <p className="mt-1 text-[13px] text-concrete-700">{project.summary}</p>
                      <p className="mt-1 text-[12px] text-concrete">
                        {[project.projectType, project.location, project.year]
                          .filter(Boolean)
                          .join(' · ') || 'No type, location or year recorded'}{' '}
                        · updated {formatDateTime(project.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {can('content:publish') && project.status !== 'PUBLISHED' && (
                        <AdminButton size="sm" onClick={() => transition(project, 'publish')}>
                          Publish
                        </AdminButton>
                      )}
                      {can('content:publish') && project.status === 'PUBLISHED' && (
                        <AdminButton
                          size="sm"
                          variant="secondary"
                          onClick={() => transition(project, 'unpublish')}
                        >
                          Unpublish
                        </AdminButton>
                      )}
                    </div>
                  </div>
                </AdminPanel>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              onChange={(next) => {
                const params2 = new URLSearchParams(params)
                params2.set('page', String(next))
                setParams(params2, { replace: true })
              }}
            />
          </div>
        </>
      )}
    </>
  )
}

/* --------------------------------------------------------------- Editor */

interface ProjectForm {
  title: string
  slug: string
  summary: string
  description: string
  projectType: string
  location: string
  clientName: string
  clientPublishable: boolean
  completedYear: number | null
  scope: string
  quantitySupplied: string
  testimonialQuote: string
  testimonialAuthor: string
  testimonialConsent: boolean
  coverImageId: string | null
  visual: string
  productIds: string[]
  featured: boolean
  displayOrder: number
  seoTitle: string
  seoDescription: string
}

const EMPTY: ProjectForm = {
  title: '',
  slug: '',
  summary: '',
  description: '',
  projectType: '',
  location: '',
  clientName: '',
  clientPublishable: false,
  completedYear: null,
  scope: '',
  quantitySupplied: '',
  testimonialQuote: '',
  testimonialAuthor: '',
  testimonialConsent: false,
  coverImageId: null,
  visual: 'infrastructure',
  productIds: [],
  featured: false,
  displayOrder: 0,
  seoTitle: '',
  seoDescription: '',
}

export function AdminProjectEdit() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { can } = useAuth()
  const { push } = useToast()

  const [form, setForm] = useState<ProjectForm>(EMPTY)
  const [meta, setMeta] = useState<{ status: string; updatedAt?: string } | null>(null)
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const load = useCallback(async () => {
    try {
      const list = await api.get<{ items: { id: string; name: string }[] }>(
        '/api/admin/catalogue/products?perPage=100',
      )
      setProducts(list.items)

      if (!isNew) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await api.get<{ project: any }>(`/api/admin/projects/${id}`)
        const project = response.project
        setForm({
          title: project.title,
          slug: project.slug,
          summary: project.summary,
          description: project.description,
          projectType: project.projectType ?? '',
          location: project.location ?? '',
          clientName: project.clientName ?? '',
          clientPublishable: project.clientPublishable,
          completedYear: project.year ?? null,
          scope: project.scope ?? '',
          quantitySupplied: project.quantitySupplied ?? '',
          testimonialQuote: project.testimonialQuote ?? '',
          testimonialAuthor: project.testimonialAuthor ?? '',
          testimonialConsent: project.testimonialConsent,
          coverImageId: project.coverImageId ?? null,
          visual: project.visual ?? 'infrastructure',
          productIds: project.products ?? [],
          featured: project.featured,
          displayOrder: project.displayOrder ?? 0,
          seoTitle: project.seoTitle ?? '',
          seoDescription: project.seoDescription ?? '',
        })
        setMeta({ status: project.status, updatedAt: project.updatedAt })
      }
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id, isNew])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    setFieldErrors({})
    try {
      if (isNew) {
        const response = await api.post<{ project: { id: string } }>('/api/admin/projects', form)
        push('success', 'Project created as a draft.')
        navigate(`/admin/projects/${response.project.id}`, { replace: true })
      } else {
        await api.put(`/api/admin/projects/${id}`, form)
        push('success', 'Changes saved.')
        await load()
      }
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setFieldErrors(caught.fieldErrors)
        push('error', caught.message)
      } else {
        push('error', 'Could not save.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label="Loading project" />
  if (error) return <ErrorState message={error} onRetry={load} />

  const readOnly = !can('content:write')

  return (
    <>
      <Link
        to="/admin/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-concrete-700 hover:text-charcoal"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        All projects
      </Link>

      <PageTitle
        title={isNew ? 'New project' : form.title || 'Project'}
        description={meta ? `Last updated ${formatDateTime(meta.updatedAt)}` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {meta && <StatusBadge status={meta.status} />}
            {!readOnly && (
              <AdminButton onClick={save} busy={saving}>
                {isNew ? 'Create draft' : 'Save changes'}
              </AdminButton>
            )}
            {!isNew && can('content:publish') && meta?.status !== 'PUBLISHED' && (
              <AdminButton
                onClick={async () => {
                  await api.post(`/api/admin/projects/${id}/publish`)
                  push('success', 'Project is now live.')
                  await load()
                }}
              >
                Publish
              </AdminButton>
            )}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <AdminPanel title="Project details">
            <div className="grid gap-4">
              <Labelled label="Title" required error={fieldErrors.title}>
                <input
                  value={form.title}
                  onChange={(event) => set('title', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Short summary" required error={fieldErrors.summary}>
                <input
                  value={form.summary}
                  onChange={(event) => set('summary', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Description" required error={fieldErrors.description}>
                <textarea
                  rows={7}
                  value={form.description}
                  onChange={(event) => set('description', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <div className="grid gap-4 sm:grid-cols-2">
                <Labelled label="Project type" hint="optional">
                  <input
                    value={form.projectType}
                    onChange={(event) => set('projectType', event.target.value)}
                    placeholder="e.g. Drainage"
                    disabled={readOnly}
                    className={inputClass}
                  />
                </Labelled>
                <Labelled label="Location" hint="only if confirmed">
                  <input
                    value={form.location}
                    onChange={(event) => set('location', event.target.value)}
                    disabled={readOnly}
                    className={inputClass}
                  />
                </Labelled>
                <Labelled label="Year completed" hint="optional" error={fieldErrors.completedYear}>
                  <input
                    type="number"
                    value={form.completedYear ?? ''}
                    onChange={(event) =>
                      set('completedYear', event.target.value ? Number(event.target.value) : null)
                    }
                    disabled={readOnly}
                    className={inputClass}
                  />
                </Labelled>
                <Labelled label="Quantity supplied" hint="only if verified">
                  <input
                    value={form.quantitySupplied}
                    onChange={(event) => set('quantitySupplied', event.target.value)}
                    disabled={readOnly}
                    className={inputClass}
                  />
                </Labelled>
              </div>
              <Labelled label="Scope of supply" hint="optional">
                <textarea
                  rows={3}
                  value={form.scope}
                  onChange={(event) => set('scope', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
            </div>
          </AdminPanel>

          <AdminPanel
            title="Client and testimonial"
            description="Both are published only when you confirm you have permission. The server enforces this too."
          >
            <p className="mb-4 flex items-start gap-2 border border-concrete-200 bg-cream p-3 text-[13px] leading-relaxed text-concrete-700">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-concrete" />
              A client name stays private unless the tick box below is on, and a testimonial cannot
              be saved for publishing without recorded consent.
            </p>
            <div className="grid gap-4">
              <Labelled label="Client name" error={fieldErrors.clientName}>
                <input
                  value={form.clientName}
                  onChange={(event) => set('clientName', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <label className="flex items-center gap-2 text-[13.5px] text-charcoal">
                <input
                  type="checkbox"
                  checked={form.clientPublishable}
                  onChange={(event) => set('clientPublishable', event.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4"
                />
                The client has agreed to be named publicly
              </label>

              <Labelled label="Testimonial quote">
                <textarea
                  rows={3}
                  value={form.testimonialQuote}
                  onChange={(event) => set('testimonialQuote', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Attributed to">
                <input
                  value={form.testimonialAuthor}
                  onChange={(event) => set('testimonialAuthor', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <label className="flex items-center gap-2 text-[13.5px] text-charcoal">
                <input
                  type="checkbox"
                  checked={form.testimonialConsent}
                  onChange={(event) => set('testimonialConsent', event.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4"
                />
                The client has approved this testimonial for publication
              </label>
              {fieldErrors.testimonialConsent && (
                <p className="text-[12.5px] text-terracotta-700">{fieldErrors.testimonialConsent}</p>
              )}
            </div>
          </AdminPanel>
        </div>

        <div className="space-y-5">
          <AdminPanel title="Cover image">
            <MediaPicker
              label="Cover"
              hint="optional"
              value={form.coverImageId}
              onChange={(mediaId) => set('coverImageId', mediaId)}
            />
            <label className="mt-4 flex items-center gap-2 text-[13.5px] text-charcoal">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) => set('featured', event.target.checked)}
                disabled={readOnly}
                className="h-4 w-4"
              />
              Feature this project
            </label>
          </AdminPanel>

          <AdminPanel title="Products supplied" description="Shown as related products on the project page.">
            {products.length === 0 ? (
              <p className="text-[13px] text-concrete-700">No products available.</p>
            ) : (
              <ul className="space-y-1.5">
                {products.map((product) => (
                  <li key={product.id}>
                    <label className="flex items-center gap-2 text-[13.5px] text-charcoal">
                      <input
                        type="checkbox"
                        checked={form.productIds.includes(product.id)}
                        onChange={() =>
                          set(
                            'productIds',
                            form.productIds.includes(product.id)
                              ? form.productIds.filter((value) => value !== product.id)
                              : [...form.productIds, product.id],
                          )
                        }
                        disabled={readOnly}
                        className="h-4 w-4 shrink-0"
                      />
                      {product.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>
        </div>
      </div>
    </>
  )
}
