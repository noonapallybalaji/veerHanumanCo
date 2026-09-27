import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiRequestError, api, assetUrl } from '../../lib/api'
import { useAuth } from '../AuthContext'
import { PageTitle } from '../components/AdminLayout'
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

/* ============================================================ Categories */

interface CategoryRow {
  id: string
  name: string
  slug: string
  summary: string
  status: string
  divisionName?: string
  productCount?: number
}

export function AdminCategories() {
  const [categories, setCategories] = useState<CategoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { can } = useAuth()
  const { push } = useToast()
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await api.get<{ categories: CategoryRow[] }>(
        '/api/admin/catalogue/categories',
      )
      setCategories(response.categories)
    } catch (caught) {
      setError((caught as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function transition(category: CategoryRow, action: string) {
    if (action === 'unpublish' || action === 'archive') {
      const result = await confirm({
        title: `Take "${category.name}" offline?`,
        message: `Any published products inside this family will also disappear from the website. ${
          category.productCount ?? 0
        } product(s) sit in it.`,
        confirmLabel: 'Continue',
        destructive: true,
      })
      if (!result.ok) return
    }
    try {
      // `confirm=true` acknowledges the server's warning about child products.
      await api.post(`/api/admin/catalogue/categories/${category.id}/${action}?confirm=true`)
      push('success', 'Family updated.')
      await load()
    } catch (caught) {
      push('error', (caught as Error).message)
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!categories) return <LoadingState label="Loading families" />

  return (
    <>
      <PageTitle
        title="Product families"
        description="The top level of the catalogue. Products always belong to exactly one family."
      />
      <ul className="space-y-3">
        {categories.map((category) => (
          <li key={category.id}>
            <AdminPanel>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={category.status} />
                    <span className="text-[11.5px] uppercase tracking-[0.08em] text-concrete">
                      {category.productCount ?? 0} product
                      {(category.productCount ?? 0) === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-charcoal">{category.name}</p>
                  <p className="mt-0.5 font-mono text-[11.5px] text-concrete">/{category.slug}</p>
                  <p className="mt-1 text-[13px] text-concrete-700">{category.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/admin/products?categoryId=${category.id}`}
                    className="inline-flex min-h-[34px] items-center rounded-sm px-3 text-[13px] font-semibold text-concrete-700 hover:text-charcoal"
                  >
                    View products
                  </Link>
                  {can('content:publish') && category.status !== 'PUBLISHED' && (
                    <AdminButton size="sm" onClick={() => transition(category, 'publish')}>
                      Publish
                    </AdminButton>
                  )}
                  {can('content:publish') && category.status === 'PUBLISHED' && (
                    <AdminButton
                      size="sm"
                      variant="secondary"
                      onClick={() => transition(category, 'unpublish')}
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
    </>
  )
}

/* ================================================================= Media */

interface MediaRow {
  id: string
  url: string
  filename: string
  width: number | null
  height: number | null
  size: number
  alt: string | null
  createdAt: string
}

export function AdminMedia() {
  const [items, setItems] = useState<MediaRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await api.get<{ media: MediaRow[] }>('/api/admin/media?kind=IMAGE')
      setItems(response.media)
    } catch (caught) {
      setError((caught as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!items) return <LoadingState label="Loading media" />

  return (
    <>
      <PageTitle
        title="Media"
        description="Images uploaded for products, families and projects. Upload new ones from the item you want to use them on."
      />
      {items.length === 0 ? (
        <EmptyState
          title="No images yet"
          description="Until you upload photographs, the website uses the built-in technical illustrations for each product."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="border border-concrete-200 bg-cream-100">
              <div className="aspect-[4/3] overflow-hidden bg-cream">
                <img
                  src={assetUrl(item.url) ?? ''}
                  alt={item.alt ?? ''}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-3">
                <p className="truncate text-[12.5px] font-medium text-charcoal">{item.filename}</p>
                <p className="mt-0.5 text-[11.5px] text-concrete">
                  {item.width}×{item.height} · {Math.round(item.size / 1024)} KB
                </p>
                <p className="mt-1 line-clamp-2 text-[11.5px] italic text-concrete-700">
                  {item.alt || 'No description set'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ================================================================= Users */

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
  lockedUntil: string | null
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super admin — full access including users and settings',
  CONTENT_EDITOR: 'Content editor — can draft and edit, cannot publish',
  REVIEW_MODERATOR: 'Review moderator — can moderate reviews only',
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ email: '', name: '', role: 'CONTENT_EDITOR', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { push } = useToast()
  const { user: current } = useAuth()

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await api.get<{ users: UserRow[]; roles: string[] }>('/api/admin/users')
      setUsers(response.users)
      setRoles(response.roles)
    } catch (caught) {
      setError((caught as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create() {
    setCreating(true)
    setFieldErrors({})
    try {
      await api.post('/api/admin/users', draft)
      push('success', `Account created for ${draft.email}. They must change the password at first sign-in.`)
      setDraft({ email: '', name: '', role: 'CONTENT_EDITOR', password: '' })
      await load()
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setFieldErrors(caught.fieldErrors)
        push('error', caught.message)
      } else {
        push('error', 'Could not create the account.')
      }
    } finally {
      setCreating(false)
    }
  }

  async function update(user: UserRow, patch: Partial<UserRow>) {
    try {
      await api.put(`/api/admin/users/${user.id}`, {
        name: patch.name ?? user.name,
        role: patch.role ?? user.role,
        isActive: patch.isActive ?? user.isActive,
      })
      push('success', 'Account updated.')
      await load()
    } catch (caught) {
      push('error', (caught as Error).message)
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!users) return <LoadingState label="Loading accounts" />

  return (
    <>
      <PageTitle
        title="Admin users"
        description="Each account gets only the access its job needs. Changing a role or disabling an account signs that person out immediately."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <AdminPanel title="Accounts">
          <ul className="divide-y divide-concrete-200">
            {users.map((user) => (
              <li key={user.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-charcoal">
                      {user.name}
                      {user.id === current?.id && (
                        <span className="ml-2 text-[11.5px] font-normal text-concrete">(you)</span>
                      )}
                    </p>
                    <p className="text-[12.5px] text-concrete-700">{user.email}</p>
                    <p className="mt-0.5 text-[11.5px] text-concrete">
                      Last signed in {formatDateTime(user.lastLoginAt)}
                      {user.lockedUntil && new Date(user.lockedUntil) > new Date() && ' · locked'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(event) => update(user, { role: event.target.value })}
                      disabled={user.id === current?.id}
                      aria-label={`Role for ${user.email}`}
                      className={`${inputClass} w-auto`}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role.replace(/_/g, ' ').toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <AdminButton
                      size="sm"
                      variant="secondary"
                      disabled={user.id === current?.id}
                      onClick={() => update(user, { isActive: !user.isActive })}
                    >
                      {user.isActive ? 'Disable' : 'Enable'}
                    </AdminButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </AdminPanel>

        <AdminPanel title="Add an account">
          <div className="grid gap-4">
            <Labelled label="Full name" required error={fieldErrors.name}>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className={inputClass}
              />
            </Labelled>
            <Labelled label="Email" required error={fieldErrors.email}>
              <input
                type="email"
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                className={inputClass}
              />
            </Labelled>
            <Labelled label="Role" required>
              <select
                value={draft.role}
                onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                className={inputClass}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role.replace(/_/g, ' ').toLowerCase()}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-[12px] text-concrete">
                {ROLE_LABELS[draft.role]}
              </span>
            </Labelled>
            <Labelled
              label="Temporary password"
              required
              hint="at least 12 characters"
              error={fieldErrors.password}
            >
              <input
                type="text"
                value={draft.password}
                onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                className={`${inputClass} font-mono`}
              />
            </Labelled>
            <AdminButton onClick={create} busy={creating}>
              Create account
            </AdminButton>
            <p className="text-[12px] leading-relaxed text-concrete">
              Share the password over a channel other than email, and ask them to change it after
              signing in. They will be prompted to.
            </p>
          </div>
        </AdminPanel>
      </div>
    </>
  )
}

/* ============================================================== Audit log */

interface AuditRow {
  id: string
  action: string
  entityType: string
  entityId: string | null
  summary: string
  reason: string | null
  createdAt: string
  actorEmail: string | null
  actor: { name: string } | null
}

export function AdminAudit() {
  const [data, setData] = useState<{
    items: AuditRow[]
    pagination: { page: number; totalPages: number; total: number }
  } | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setData(await api.get(`/api/admin/audit?page=${page}`))
    } catch (caught) {
      setError((caught as Error).message)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return <LoadingState label="Loading audit log" />

  return (
    <>
      <PageTitle
        title="Audit log"
        description="A record of significant admin actions. Passwords, tokens and raw IP addresses are never logged."
      />
      {data.items.length === 0 ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        <>
          <div className="overflow-x-auto border border-concrete-200 bg-cream-100">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-concrete-200 bg-cream-200 text-[11.5px] uppercase tracking-[0.1em] text-concrete">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">When</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Who</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Action</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-concrete-200">
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[12.5px] text-concrete">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-charcoal-600">
                      {entry.actor?.name ?? entry.actorEmail ?? 'System'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11.5px] text-concrete-700">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-charcoal">
                      {entry.summary}
                      {entry.reason && (
                        <span className="mt-0.5 block text-[12px] italic text-concrete">
                          {entry.reason}
                        </span>
                      )}
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
              onChange={setPage}
            />
          </div>
        </>
      )}
    </>
  )
}
