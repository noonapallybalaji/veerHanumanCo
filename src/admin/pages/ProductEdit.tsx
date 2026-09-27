import { ArrowLeft, Info, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiRequestError, api } from '../../lib/api'
import { useAuth } from '../AuthContext'
import { PageTitle } from '../components/AdminLayout'
import { MediaPicker } from '../components/MediaPicker'
import {
  AdminButton,
  AdminPanel,
  ErrorState,
  Labelled,
  LoadingState,
  StatusBadge,
  formatDateTime,
  inputClass,
  useConfirm,
  useToast,
} from '../components/ui'

interface SpecRow {
  label: string
  value: string
}

interface ProductForm {
  categoryId: string
  name: string
  seoName: string
  slug: string
  sku: string
  summary: string
  description: string
  visual: string
  mainImageId: string | null
  specifications: SpecRow[]
  useCases: string[]
  applications: string[]
  requirementTags: string[]
  relatedProducts: string[]
  featured: boolean
  displayOrder: number
  seoTitle: string
  seoDescription: string
}

interface Taxonomy {
  applications: { id: string; name: string; slug: string }[]
  requirementTags: { id: string; name: string; slug: string }[]
}

const VISUALS = [
  'rcc-chamber',
  'rcc-manhole-cover',
  'rcc-pole',
  'rcc-tree-guard',
  'frp-frame-cover',
  'frp-thermodrain',
  'frp-gully',
  'pipe-hdpe',
  'pipe-ecodrain',
  'pipe-dwc',
  'landscaping',
  'infrastructure',
]

const EMPTY: ProductForm = {
  categoryId: '',
  name: '',
  seoName: '',
  slug: '',
  sku: '',
  summary: '',
  description: '',
  visual: 'infrastructure',
  mainImageId: null,
  specifications: [],
  useCases: [],
  applications: [],
  requirementTags: [],
  relatedProducts: [],
  featured: false,
  displayOrder: 0,
  seoTitle: '',
  seoDescription: '',
}

export default function ProductEdit() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { can } = useAuth()
  const { push } = useToast()
  const confirm = useConfirm()

  const [form, setForm] = useState<ProductForm>(EMPTY)
  const [meta, setMeta] = useState<{ status: string; updatedAt?: string; slug?: string } | null>(
    null,
  )
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([])
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({ applications: [], requirementTags: [] })
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const load = useCallback(async () => {
    try {
      const [cats, tax, list] = await Promise.all([
        api.get<{ categories: { id: string; name: string; slug: string }[] }>(
          '/api/admin/catalogue/categories',
        ),
        api.get<Taxonomy>('/api/admin/catalogue/taxonomy'),
        api.get<{ items: { id: string; name: string }[] }>(
          '/api/admin/catalogue/products?perPage=100',
        ),
      ])
      setCategories(cats.categories)
      setTaxonomy(tax)
      setAllProducts(list.items)

      if (!isNew) {
        const response = await api.get<{ product: Record<string, unknown> }>(
          `/api/admin/catalogue/products/${id}`,
        )
        const product = response.product as never as ProductForm & {
          status: string
          updatedAt: string
          slug: string
        }
        setForm({
          categoryId: product.categoryId,
          name: product.name,
          seoName: product.seoName ?? '',
          slug: product.slug,
          sku: product.sku ?? '',
          summary: product.summary,
          description: product.description,
          visual: product.visual,
          mainImageId: product.mainImageId ?? null,
          specifications: product.specifications ?? [],
          useCases: product.useCases ?? [],
          applications: product.applications ?? [],
          requirementTags: product.requirementTags ?? [],
          relatedProducts: product.relatedProducts ?? [],
          featured: product.featured ?? false,
          displayOrder: product.displayOrder ?? 0,
          seoTitle: product.seoTitle ?? '',
          seoDescription: product.seoDescription ?? '',
        })
        setMeta({ status: product.status, updatedAt: product.updatedAt, slug: product.slug })
      } else {
        setForm((current) => ({ ...current, categoryId: cats.categories[0]?.id ?? '' }))
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

  async function save(): Promise<string | null> {
    setSaving(true)
    setFieldErrors({})
    try {
      const body = { ...form, displayOrder: Number(form.displayOrder) || 0 }
      if (isNew) {
        const response = await api.post<{ product: { id: string } }>(
          '/api/admin/catalogue/products',
          body,
        )
        push('success', 'Product created as a draft.')
        navigate(`/admin/products/${response.product.id}`, { replace: true })
        return response.product.id
      }
      await api.put(`/api/admin/catalogue/products/${id}`, body)
      push('success', 'Changes saved.')
      await load()
      return id ?? null
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setFieldErrors(caught.fieldErrors)
        push('error', caught.message)
      } else {
        push('error', 'Could not save. Check your connection.')
      }
      return null
    } finally {
      setSaving(false)
    }
  }

  async function transition(action: string) {
    if (action === 'unpublish' || action === 'archive') {
      const result = await confirm({
        title: action === 'archive' ? 'Archive this product?' : 'Take this product offline?',
        message:
          'It will stop appearing on the website and in the sitemap. Nothing is deleted and you can reverse this at any time.',
        confirmLabel: action === 'archive' ? 'Archive' : 'Unpublish',
        destructive: true,
      })
      if (!result.ok) return
    }
    try {
      await api.post(`/api/admin/catalogue/products/${id}/${action}`)
      push('success', `Product ${action === 'publish' ? 'is now live' : `${action}ed`}.`)
      await load()
    } catch (caught) {
      push('error', (caught as Error).message)
    }
  }

  function toggle(key: 'applications' | 'requirementTags' | 'relatedProducts', value: string) {
    setForm((current) => {
      const list = current[key]
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      }
    })
  }

  if (loading) return <LoadingState label="Loading product" />
  if (error) return <ErrorState message={error} onRetry={load} />

  const readOnly = !can('content:write')
  const categorySlug = categories.find((category) => category.id === form.categoryId)?.slug

  return (
    <>
      <Link
        to="/admin/products"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-concrete-700 hover:text-charcoal"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        All products
      </Link>

      <PageTitle
        title={isNew ? 'New product' : form.name || 'Product'}
        description={
          meta
            ? `Last updated ${formatDateTime(meta.updatedAt)}`
            : 'New products are saved as a draft and stay off the website until published.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {meta && <StatusBadge status={meta.status} />}
            {!isNew && meta?.status === 'PUBLISHED' && categorySlug && (
              <a
                href={`/products/${categorySlug}/${meta.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center rounded-sm px-3 text-sm font-semibold text-concrete-700 hover:text-charcoal"
              >
                View live
              </a>
            )}
            {!readOnly && (
              <AdminButton onClick={save} busy={saving}>
                {isNew ? 'Create draft' : 'Save changes'}
              </AdminButton>
            )}
            {!isNew && can('content:publish') && meta?.status !== 'PUBLISHED' && (
              <AdminButton variant="primary" onClick={() => transition('publish')}>
                Publish
              </AdminButton>
            )}
            {!isNew && can('content:publish') && meta?.status === 'PUBLISHED' && (
              <AdminButton variant="secondary" onClick={() => transition('unpublish')}>
                Unpublish
              </AdminButton>
            )}
            {!isNew && !can('content:publish') && can('content:write') && (
              <AdminButton variant="secondary" onClick={() => transition('submit')}>
                Submit for review
              </AdminButton>
            )}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <AdminPanel title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Labelled label="Product name" required error={fieldErrors.name}>
                <input
                  value={form.name}
                  onChange={(event) => set('name', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled
                label="Fuller name"
                hint="for page titles"
                error={fieldErrors.seoName}
              >
                <input
                  value={form.seoName}
                  onChange={(event) => set('seoName', event.target.value)}
                  placeholder='e.g. "HDPE Pipes"'
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Product family" required error={fieldErrors.categoryId}>
                <select
                  value={form.categoryId}
                  onChange={(event) => set('categoryId', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled label="URL slug" hint="leave blank to generate" error={fieldErrors.slug}>
                <input
                  value={form.slug}
                  onChange={(event) => set('slug', event.target.value)}
                  disabled={readOnly}
                  className={`${inputClass} font-mono`}
                />
              </Labelled>
              <Labelled label="Product code / SKU" error={fieldErrors.sku}>
                <input
                  value={form.sku}
                  onChange={(event) => set('sku', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Display order" hint="lower shows first">
                <input
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(event) => set('displayOrder', Number(event.target.value))}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Short summary" required error={fieldErrors.summary} className="sm:col-span-2">
                <input
                  value={form.summary}
                  onChange={(event) => set('summary', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Full description" required error={fieldErrors.description} className="sm:col-span-2">
                <textarea
                  rows={7}
                  value={form.description}
                  onChange={(event) => set('description', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
            </div>
          </AdminPanel>

          <AdminPanel
            title="Specifications"
            description="Only add figures the business has confirmed. Leave this empty and the page shows 'Specifications available on request.'"
            actions={
              !readOnly && (
                <AdminButton
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    set('specifications', [...form.specifications, { label: '', value: '' }])
                  }
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  Add row
                </AdminButton>
              )
            }
          >
            {form.specifications.length === 0 ? (
              <p className="flex items-start gap-2 text-[13.5px] text-concrete-700">
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-concrete" />
                No specifications recorded. That is the honest default until the owner supplies
                dimensions, grades or ratings.
              </p>
            ) : (
              <ul className="space-y-2">
                {form.specifications.map((row, index) => (
                  <li key={index} className="flex gap-2">
                    <input
                      value={row.label}
                      placeholder="Label, e.g. Diameter"
                      onChange={(event) => {
                        const next = [...form.specifications]
                        next[index] = { ...row, label: event.target.value }
                        set('specifications', next)
                      }}
                      disabled={readOnly}
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      value={row.value}
                      placeholder="Value"
                      onChange={(event) => {
                        const next = [...form.specifications]
                        next[index] = { ...row, value: event.target.value }
                        set('specifications', next)
                      }}
                      disabled={readOnly}
                      className={`${inputClass} flex-1`}
                    />
                    {!readOnly && (
                      <AdminButton
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          set(
                            'specifications',
                            form.specifications.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove row {index + 1}</span>
                      </AdminButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          <AdminPanel
            title="Typical use cases"
            actions={
              !readOnly && (
                <AdminButton
                  size="sm"
                  variant="secondary"
                  onClick={() => set('useCases', [...form.useCases, ''])}
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  Add
                </AdminButton>
              )
            }
          >
            {form.useCases.length === 0 ? (
              <p className="text-[13.5px] text-concrete-700">None added.</p>
            ) : (
              <ul className="space-y-2">
                {form.useCases.map((useCase, index) => (
                  <li key={index} className="flex gap-2">
                    <input
                      value={useCase}
                      onChange={(event) => {
                        const next = [...form.useCases]
                        next[index] = event.target.value
                        set('useCases', next)
                      }}
                      disabled={readOnly}
                      className={`${inputClass} flex-1`}
                    />
                    {!readOnly && (
                      <AdminButton
                        size="sm"
                        variant="ghost"
                        onClick={() => set('useCases', form.useCases.filter((_, i) => i !== index))}
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove use case {index + 1}</span>
                      </AdminButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          <AdminPanel title="Search engine listing">
            <div className="space-y-4">
              <Labelled label="SEO title" hint="defaults to the product name">
                <input
                  value={form.seoTitle}
                  onChange={(event) => set('seoTitle', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Meta description" hint="defaults to the summary">
                <textarea
                  rows={3}
                  value={form.seoDescription}
                  onChange={(event) => set('seoDescription', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
            </div>
          </AdminPanel>
        </div>

        <div className="space-y-5">
          <AdminPanel title="Image">
            <MediaPicker
              label="Main image"
              hint="optional"
              value={form.mainImageId}
              onChange={(mediaId) => set('mainImageId', mediaId)}
            />
            <div className="mt-4">
              <Labelled
                label="Fallback illustration"
                hint="used when there is no photograph"
              >
                <select
                  value={form.visual}
                  onChange={(event) => set('visual', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                >
                  {VISUALS.map((visual) => (
                    <option key={visual} value={visual}>
                      {visual.replace(/-/g, ' ')}
                    </option>
                  ))}
                </select>
              </Labelled>
            </div>
            <label className="mt-4 flex items-center gap-2 text-[13.5px] text-charcoal">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) => set('featured', event.target.checked)}
                disabled={readOnly}
                className="h-4 w-4"
              />
              Feature this product
            </label>
          </AdminPanel>

          <AdminPanel
            title="Applications"
            description="Where this product is used. Discovery only - it does not change which family the product belongs to."
          >
            <CheckList
              options={taxonomy.applications.map((item) => ({ value: item.slug, label: item.name }))}
              selected={form.applications}
              onToggle={(value) => toggle('applications', value)}
              disabled={readOnly}
            />
          </AdminPanel>

          <AdminPanel title="Requirement tags" description="Drives the requirement finder.">
            <CheckList
              options={taxonomy.requirementTags.map((item) => ({
                value: item.slug,
                label: item.name,
              }))}
              selected={form.requirementTags}
              onToggle={(value) => toggle('requirementTags', value)}
              disabled={readOnly}
            />
          </AdminPanel>

          <AdminPanel title="Related products">
            <CheckList
              options={allProducts
                .filter((product) => product.id !== id)
                .map((product) => ({ value: product.id, label: product.name }))}
              selected={form.relatedProducts}
              onToggle={(value) => toggle('relatedProducts', value)}
              disabled={readOnly}
            />
          </AdminPanel>

          {!isNew && can('content:publish') && (
            <AdminPanel title="Danger zone">
              <p className="mb-3 text-[13px] leading-relaxed text-concrete-700">
                Archiving hides the product everywhere but keeps its reviews, project links and
                enquiry history intact. Prefer it to deleting.
              </p>
              <AdminButton variant="danger" size="sm" onClick={() => transition('archive')}>
                Archive product
              </AdminButton>
            </AdminPanel>
          )}
        </div>
      </div>
    </>
  )
}

function CheckList({
  options,
  selected,
  onToggle,
  disabled,
}: {
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  disabled?: boolean
}) {
  if (options.length === 0) return <p className="text-[13px] text-concrete-700">Nothing to pick.</p>
  return (
    <ul className="space-y-1.5">
      {options.map((option) => (
        <li key={option.value}>
          <label className="flex items-center gap-2 text-[13.5px] text-charcoal">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
              disabled={disabled}
              className="h-4 w-4 shrink-0"
            />
            {option.label}
          </label>
        </li>
      ))}
    </ul>
  )
}
