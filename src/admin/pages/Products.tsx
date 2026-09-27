import { Copy, ExternalLink, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiRequestError, api } from '../../lib/api'
import { useAuth } from '../AuthContext'
import { PageTitle } from '../components/AdminLayout'
import {
  AdminButton,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  StatusBadge,
  formatDateTime,
  inputClass,
  useConfirm,
  useToast,
} from '../components/ui'

interface AdminProductRow {
  id: string
  name: string
  slug: string
  status: string
  categoryId: string
  categoryName?: string
  featured: boolean
  updatedAt: string
  updatedBy: { id: string; name: string } | null
}

interface ListResponse {
  items: AdminProductRow[]
  pagination: { page: number; perPage: number; total: number; totalPages: number }
}

interface Category {
  id: string
  name: string
  slug: string
}

export default function AdminProducts() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<ListResponse | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState(params.get('search') ?? '')
  const { can } = useAuth()
  const { push } = useToast()
  const confirm = useConfirm()

  const page = Number(params.get('page') ?? '1')
  const status = params.get('status') ?? ''
  const categoryId = params.get('categoryId') ?? ''
  const activeSearch = params.get('search') ?? ''

  const load = useCallback(async () => {
    setError(null)
    try {
      const query = new URLSearchParams({ page: String(page) })
      if (status) query.set('status', status)
      if (categoryId) query.set('categoryId', categoryId)
      if (activeSearch) query.set('search', activeSearch)
      setData(await api.get<ListResponse>(`/api/admin/catalogue/products?${query}`))
    } catch (caught) {
      setError((caught as Error).message)
    }
  }, [page, status, categoryId, activeSearch])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    api
      .get<{ categories: Category[] }>('/api/admin/catalogue/categories')
      .then((response) => setCategories(response.categories))
      .catch(() => setCategories([]))
  }, [])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // Any filter change returns to the first page, or the list looks empty.
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  async function transition(product: AdminProductRow, action: string) {
    const destructive = action === 'archive' || action === 'unpublish'
    if (destructive) {
      const result = await confirm({
        title: action === 'archive' ? 'Archive this product?' : 'Take this product offline?',
        message: (
          <>
            <strong>{product.name}</strong> will stop appearing on the website, including in search
            results, the requirement finder and the sitemap. Nothing is deleted and you can put it
            back at any time.
          </>
        ),
        confirmLabel: action === 'archive' ? 'Archive' : 'Unpublish',
        destructive: true,
      })
      if (!result.ok) return
    }

    setBusyId(product.id)
    try {
      await api.post(`/api/admin/catalogue/products/${product.id}/${action}`)
      push('success', `"${product.name}" ${pastTense(action)}.`)
      await load()
    } catch (caught) {
      push('error', caught instanceof ApiRequestError ? caught.message : 'That did not work.')
    } finally {
      setBusyId(null)
    }
  }

  async function duplicate(product: AdminProductRow) {
    setBusyId(product.id)
    try {
      await api.post(`/api/admin/catalogue/products/${product.id}/duplicate`)
      push('success', `Duplicated "${product.name}" as a new draft.`)
      await load()
    } catch (caught) {
      push('error', (caught as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageTitle
        title="Products"
        description="Everything in the catalogue. Only published products appear on the website."
        actions={
          can('content:write') ? (
            <AdminButton onClick={() => (window.location.href = '/admin/products/new')}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              New product
            </AdminButton>
          ) : null
        }
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
              placeholder="Name, slug or code"
              className={inputClass}
            />
          </label>
          <AdminButton type="submit" variant="secondary">
            <Search aria-hidden="true" className="h-4 w-4" />
            Search
          </AdminButton>
        </form>

        <label>
          <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-concrete">
            Status
          </span>
          <select
            value={status}
            onChange={(event) => setParam('status', event.target.value)}
            className={inputClass}
          >
            <option value="">All statuses</option>
            {['PUBLISHED', 'DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'ARCHIVED'].map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-concrete">
            Family
          </span>
          <select
            value={categoryId}
            onChange={(event) => setParam('categoryId', event.target.value)}
            className={inputClass}
          >
            <option value="">All families</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        {(status || categoryId || activeSearch) && (
          <AdminButton
            variant="ghost"
            onClick={() => {
              setSearch('')
              setParams(new URLSearchParams(), { replace: true })
            }}
          >
            Clear
          </AdminButton>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !data && <LoadingState label="Loading products" />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No products match"
          description={
            activeSearch || status || categoryId
              ? 'Try clearing the filters above.'
              : 'Add your first product to get the catalogue started.'
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto border border-concrete-200 bg-cream-100">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-concrete-200 bg-cream-200 text-[11.5px] uppercase tracking-[0.1em] text-concrete">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Product</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Family</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Updated</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-concrete-200">
                {data.items.map((product) => (
                  <tr key={product.id} className={busyId === product.id ? 'opacity-50' : undefined}>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="font-medium text-charcoal hover:text-terracotta"
                      >
                        {product.name}
                      </Link>
                      <span className="mt-0.5 block font-mono text-[11.5px] text-concrete">
                        /{product.slug}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-concrete-700">{product.categoryName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-concrete">
                      {formatDateTime(product.updatedAt)}
                      {product.updatedBy && (
                        <span className="block text-[11.5px]">by {product.updatedBy.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {product.status === 'PUBLISHED' && (
                          <a
                            href={`/products/${categorySlug(categories, product.categoryId)}/${product.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-sm px-2 text-[12.5px] font-semibold text-concrete-700 hover:text-charcoal"
                          >
                            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                            View
                          </a>
                        )}
                        {can('content:write') && (
                          <AdminButton size="sm" variant="ghost" onClick={() => duplicate(product)}>
                            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                            Duplicate
                          </AdminButton>
                        )}
                        {can('content:publish') && product.status !== 'PUBLISHED' && (
                          <AdminButton size="sm" onClick={() => transition(product, 'publish')}>
                            Publish
                          </AdminButton>
                        )}
                        {can('content:publish') && product.status === 'PUBLISHED' && (
                          <AdminButton
                            size="sm"
                            variant="secondary"
                            onClick={() => transition(product, 'unpublish')}
                          >
                            Unpublish
                          </AdminButton>
                        )}
                        {can('content:write') && !can('content:publish') && product.status === 'DRAFT' && (
                          <AdminButton size="sm" onClick={() => transition(product, 'submit')}>
                            Submit for review
                          </AdminButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

function categorySlug(categories: Category[], id: string): string {
  return categories.find((category) => category.id === id)?.slug ?? 'products'
}

function pastTense(action: string): string {
  const map: Record<string, string> = {
    publish: 'is now live',
    unpublish: 'has been taken offline',
    archive: 'has been archived',
    restore: 'has been restored to draft',
    submit: 'has been submitted for review',
  }
  return map[action] ?? 'updated'
}
