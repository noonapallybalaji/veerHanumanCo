import {
  Boxes,
  ClipboardList,
  FileText,
  Gauge,
  Images,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  ScrollText,
  Settings,
  Star,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useAuth } from '../AuthContext'
import { AdminButton, useToast } from './ui'

/**
 * Admin shell: persistent sidebar on desktop, slide-over on mobile.
 *
 * Navigation entries declare the permission they need and are filtered for
 * the signed-in role, so a moderator is not shown doors they cannot open.
 * The server enforces the same rules independently.
 */
const NAV = [
  { to: '/admin', label: 'Overview', icon: Gauge, permission: 'content:read', end: true },
  { to: '/admin/products', label: 'Products', icon: Boxes, permission: 'content:read' },
  { to: '/admin/categories', label: 'Categories', icon: Layers, permission: 'content:read' },
  { to: '/admin/projects', label: 'Projects', icon: ClipboardList, permission: 'content:read' },
  { to: '/admin/reviews', label: 'Reviews', icon: Star, permission: 'review:read' },
  { to: '/admin/enquiries', label: 'Enquiries', icon: MessageSquare, permission: 'enquiry:read' },
  { to: '/admin/leads', label: 'Leads', icon: UserRound, permission: 'enquiry:read' },
  { to: '/admin/content', label: 'Website Content', icon: FileText, permission: 'content:read' },
  { to: '/admin/media', label: 'Media', icon: Images, permission: 'content:read' },
  { to: '/admin/company', label: 'Company & Contact', icon: Settings, permission: 'content:read' },
  { to: '/admin/users', label: 'Admin Users', icon: Users, permission: 'user:manage' },
  { to: '/admin/audit', label: 'Audit Log', icon: ScrollText, permission: 'audit:read' },
]

export function AdminLayout() {
  const { user, signOut, can } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { push } = useToast()

  const items = NAV.filter((item) => can(item.permission))

  async function handleSignOut() {
    await signOut()
    push('info', 'Signed out.')
    navigate('/admin/login', { replace: true })
  }

  const nav = (
    <nav aria-label="Admin sections" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-sm px-3 py-2 text-[13.5px] font-medium transition-colors',
                isActive
                  ? 'bg-cream/10 text-cream'
                  : 'text-cream/60 hover:bg-cream/5 hover:text-cream',
              )
            }
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-cream-200">
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-concrete-200 bg-charcoal px-4 py-3 lg:hidden">
        <span className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-cream">
          VH Admin
        </span>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open admin menu"
          className="flex h-10 w-10 items-center justify-center rounded-sm border border-cream/25 text-cream"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="on-dark sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between bg-charcoal p-4 lg:flex">
          <div>
            <div className="mb-6 px-3">
              <p className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-cream">
                Veer Hanuman
              </p>
              <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-terracotta-400">
                Admin
              </p>
            </div>
            {nav}
          </div>
          <SidebarFooter name={user?.name} role={user?.role} onSignOut={handleSignOut} />
        </aside>

        {/* Mobile slide-over */}
        {menuOpen && (
          <div className="fixed inset-0 z-[70] flex lg:hidden">
            <div
              className="flex-1 bg-charcoal/60"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <aside className="on-dark flex w-72 flex-col justify-between overflow-y-auto bg-charcoal p-4">
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <span className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-cream">
                    Admin
                  </span>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close admin menu"
                    className="flex h-9 w-9 items-center justify-center rounded-sm border border-cream/25 text-cream"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
                {nav}
              </div>
              <SidebarFooter name={user?.name} role={user?.role} onSignOut={handleSignOut} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarFooter({
  name,
  role,
  onSignOut,
}: {
  name?: string
  role?: string
  onSignOut: () => void
}) {
  return (
    <div className="mt-6 border-t border-cream/15 pt-4">
      <p className="px-3 text-[13px] font-semibold text-cream">{name ?? 'Signed in'}</p>
      <p className="px-3 text-[11px] uppercase tracking-[0.12em] text-cream/45">
        {role?.replace(/_/g, ' ').toLowerCase()}
      </p>
      <div className="mt-3 flex flex-col gap-1.5 px-1">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm px-2 py-1.5 text-[13px] text-cream/60 hover:text-cream"
        >
          View website &rarr;
        </a>
        <AdminButton variant="ghost" size="sm" onClick={onSignOut} className="justify-start !text-cream/60 hover:!bg-cream/5 hover:!text-cream">
          <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
          Sign out
        </AdminButton>
      </div>
    </div>
  )
}

export function PageTitle({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[26px] leading-tight sm:text-[30px]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-concrete-700">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
