import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { VisitorProvider } from './visitor/VisitorContext'
import Home from './pages/Home'
import Products from './pages/Products'

/**
 * Routes mirror the business hierarchy exactly:
 *
 *   /products/:categorySlug/:productSlug
 *   /services/:serviceSlug
 *
 * Home and Products are bundled eagerly because they are the two entry
 * points almost every visit starts from. Everything else is code-split so
 * the first load stays small on mobile networks.
 */
const CategoryPage = lazy(() => import('./pages/CategoryPage'))
const ProductPage = lazy(() => import('./pages/ProductPage'))
const Services = lazy(() => import('./pages/Services'))
const ServicePage = lazy(() => import('./pages/ServicePage'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectPage = lazy(() => import('./pages/ProjectPage'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const RequestQuote = lazy(() => import('./pages/RequestQuote'))
const NotFound = lazy(() => import('./pages/NotFound'))

/**
 * The admin panel is a separate code-split bundle outside the public
 * Layout, so a visitor who never opens /admin never downloads any of it.
 */
const AdminApp = lazy(() => import('./admin/AdminApp'))

/** Neutral placeholder while a route chunk loads. */
function RouteFallback() {
  return (
    <div className="shell py-24" role="status" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-3 w-24 animate-pulse rounded-sm bg-concrete-200" />
        <div className="h-9 w-2/3 max-w-md animate-pulse rounded-sm bg-concrete-200" />
        <div className="h-4 w-1/2 max-w-sm animate-pulse rounded-sm bg-concrete-200" />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <VisitorProvider>
      <AppRoutes />
    </VisitorProvider>
  )
}

/**
 * Routes are split out so the visitor session provider wraps the whole
 * public tree — the welcome modal and every enquiry form read from it.
 */
function AppRoutes() {
  return (
    <Routes>
      {/* Admin, deliberately outside the public Layout: no site header,
          footer or mobile action bar. */}
      <Route
        path="admin/*"
        element={
          <Suspense fallback={<RouteFallback />}>
            <AdminApp />
          </Suspense>
        }
      />

      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Products />} />

        <Route
          path="products/:categorySlug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <CategoryPage />
            </Suspense>
          }
        />
        <Route
          path="products/:categorySlug/:productSlug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ProductPage />
            </Suspense>
          }
        />

        <Route
          path="services"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Services />
            </Suspense>
          }
        />
        <Route
          path="services/:serviceSlug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ServicePage />
            </Suspense>
          }
        />

        <Route
          path="projects"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Projects />
            </Suspense>
          }
        />
        <Route
          path="projects/:slug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ProjectPage />
            </Suspense>
          }
        />
        <Route
          path="about"
          element={
            <Suspense fallback={<RouteFallback />}>
              <About />
            </Suspense>
          }
        />
        <Route
          path="contact"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Contact />
            </Suspense>
          }
        />
        <Route
          path="request-quote"
          element={
            <Suspense fallback={<RouteFallback />}>
              <RequestQuote />
            </Suspense>
          }
        />

        {/* Legacy / convenience aliases so older links keep working. */}
        <Route path="about-us" element={<Navigate to="/about" replace />} />
        <Route path="quote" element={<Navigate to="/request-quote" replace />} />

        <Route
          path="*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <NotFound />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}
