import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { PageTitle } from '../components/AdminLayout'
import {
  AdminPanel,
  ErrorState,
  LoadingState,
  StatusBadge,
  formatDateTime,
} from '../components/ui'

interface DashboardData {
  products: { published: number; draft: number; inReview: number; archived: number }
  projects: { published: number; draft: number }
  reviews: { pending: number; reported: number; published: number }
  enquiries: { new: number; total: number }
  recentActivity: { id: string; action: string; summary: string; actor: string; at: string }[]
  recentContent: { id: string; name: string; slug: string; status: string; updatedAt: string }[]
}

/**
 * Overview.
 *
 * Every figure comes from a live database count. Nothing here is seeded or
 * illustrative — an empty site shows zeros, which is the honest signal.
 */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      setData(await api.get<DashboardData>('/api/admin/dashboard'))
    } catch (caught) {
      setError((caught as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return <LoadingState label="Loading overview" />

  const cards = [
    { label: 'Published products', value: data.products.published, to: '/admin/products?status=PUBLISHED' },
    { label: 'Draft products', value: data.products.draft, to: '/admin/products?status=DRAFT' },
    { label: 'Published projects', value: data.projects.published, to: '/admin/projects?status=PUBLISHED' },
    { label: 'Reviews awaiting moderation', value: data.reviews.pending, to: '/admin/reviews?status=PENDING', highlight: data.reviews.pending > 0 },
    { label: 'Reported reviews', value: data.reviews.reported, to: '/admin/reviews', highlight: data.reviews.reported > 0 },
    { label: 'New enquiries', value: data.enquiries.new, to: '/admin/enquiries?status=NEW', highlight: data.enquiries.new > 0 },
  ]

  return (
    <>
      <PageTitle
        title="Overview"
        description="Live counts from the database. Nothing here is sample data."
      />

      <ul className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.label}>
            <Link
              to={card.to}
              className={`block border p-4 transition-colors hover:border-charcoal/40 ${
                card.highlight
                  ? 'border-terracotta/40 bg-terracotta-100'
                  : 'border-concrete-200 bg-cream-100'
              }`}
            >
              <span className="block font-display text-[28px] font-extrabold leading-none text-charcoal">
                {card.value}
              </span>
              <span className="mt-2 block text-[12.5px] leading-snug text-concrete-700">
                {card.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminPanel title="Recently updated products">
          {data.recentContent.length === 0 ? (
            <p className="text-sm text-concrete-700">No products yet.</p>
          ) : (
            <ul className="divide-y divide-concrete-200">
              {data.recentContent.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link
                    to={`/admin/products/${item.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-charcoal hover:text-terracotta"
                  >
                    {item.name}
                  </Link>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>

        <AdminPanel
          title="Recent admin activity"
          description="The last few recorded changes."
        >
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-concrete-700">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-concrete-200">
              {data.recentActivity.map((entry) => (
                <li key={entry.id} className="py-2.5">
                  <p className="text-[13.5px] text-charcoal">{entry.summary}</p>
                  <p className="mt-0.5 text-[12px] text-concrete">
                    {entry.actor} · {formatDateTime(entry.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </>
  )
}
