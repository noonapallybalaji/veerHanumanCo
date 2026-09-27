import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { AdminLayout } from './components/AdminLayout'
import { ConfirmProvider, LoadingState, ToastProvider } from './components/ui'
import AdminLogin from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminProductsList from './pages/Products'
import ProductEdit from './pages/ProductEdit'
import AdminReviews from './pages/Reviews'
import AdminCompany from './pages/Company'
import AdminEnquiries from './pages/Enquiries'
import AdminLeads from './pages/Leads'
import AdminContent from './pages/Content'
import { AdminProjectEdit, AdminProjects } from './pages/Projects'
import { AdminAudit, AdminCategories, AdminMedia, AdminUsers } from './pages/Misc'

/**
 * Admin application, mounted under /admin.
 *
 * Route guarding here is for usability — it keeps a signed-out visitor from
 * seeing an empty shell. Authorisation is enforced on the server for every
 * request; nothing in this file is a security boundary.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-200">
        <LoadingState label="Checking your session" />
      </div>
    )
  }
  if (!user) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

/** Shown when a role lacks the permission a section needs. */
function RequirePermission({
  permission,
  children,
}: {
  permission: string
  children: React.ReactNode
}) {
  const { can } = useAuth()
  if (!can(permission)) {
    return (
      <div className="border border-concrete-200 bg-cream-100 p-8">
        <h1 className="text-xl">Not available to your role</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-concrete-700">
          Your account does not have access to this section. If you need it, ask a super admin to
          change your role.
        </p>
      </div>
    )
  }
  return <>{children}</>
}

/**
 * Keeps the admin panel out of search results.
 *
 * robots.txt disallows /admin, but that is a request not to crawl, not a
 * rule against indexing a URL discovered elsewhere. A meta robots tag is
 * the directive that actually prevents indexing, and it is removed again on
 * unmount so it never leaks onto a public page.
 */
function useNoIndex() {
  useEffect(() => {
    const previous = document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
    }
    meta.content = 'noindex, nofollow, noarchive'

    return () => {
      const current = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
      if (current) current.content = previous ?? 'index, follow'
    }
  }, [])
}

export default function AdminApp() {
  useNoIndex()

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <Routes>
            <Route path="login" element={<AdminLogin />} />
            <Route
              element={
                <RequireAuth>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="products" element={<AdminProductsList />} />
              <Route path="products/:id" element={<ProductEdit />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="projects/:id" element={<AdminProjectEdit />} />
              <Route
                path="reviews"
                element={
                  <RequirePermission permission="review:read">
                    <AdminReviews />
                  </RequirePermission>
                }
              />
              <Route
                path="enquiries"
                element={
                  <RequirePermission permission="enquiry:read">
                    <AdminEnquiries />
                  </RequirePermission>
                }
              />
              <Route
                path="leads"
                element={
                  <RequirePermission permission="enquiry:read">
                    <AdminLeads />
                  </RequirePermission>
                }
              />
              <Route path="content" element={<AdminContent />} />
              <Route path="media" element={<AdminMedia />} />
              <Route path="company" element={<AdminCompany />} />
              <Route
                path="users"
                element={
                  <RequirePermission permission="user:manage">
                    <AdminUsers />
                  </RequirePermission>
                }
              />
              <Route
                path="audit"
                element={
                  <RequirePermission permission="audit:read">
                    <AdminAudit />
                  </RequirePermission>
                }
              />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
