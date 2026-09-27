import { ChevronDown, Menu, Phone, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { activeServices, getProductsByCategory, productCategories } from '../../data'
import { cn } from '../../lib/cn'
import { formatPhone, hasPhone, telHref } from '../../lib/contact'
import { categoryUrl, paths, productUrl, serviceUrl } from '../../lib/paths'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { Button } from '../ui/Button'
import { WhatsAppButton } from '../ui/WhatsAppButton'
import { generalEnquiryMessage } from '../../lib/contact'
import { Logo } from './Logo'

const navItems = [
  { label: 'Products', to: paths.products, hasPanel: true },
  { label: 'Services', to: paths.services, hasPanel: false },
  { label: 'Projects', to: paths.projects, hasPanel: false },
  { label: 'About Us', to: paths.about, hasPanel: false },
  { label: 'Contact', to: paths.contact, hasPanel: false },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLLIElement>(null)
  const location = useLocation()

  /*
   * Close both menus whenever the route changes. Adjusting state during
   * render (React's documented pattern for reacting to a changed prop)
   * rather than in an effect, so the closed menu is painted in the same
   * pass as the new route instead of flashing open for one frame.
   *
   * The menu links close themselves on click; this also covers navigation
   * that did not come from a click, such as the browser back button.
   */
  const routeKey = `${location.pathname}${location.search}`
  const [lastRouteKey, setLastRouteKey] = useState(routeKey)
  if (lastRouteKey !== routeKey) {
    setLastRouteKey(routeKey)
    setMobileOpen(false)
    setPanelOpen(false)
  }

  // Lock background scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  // Escape closes, and a click outside dismisses the desktop panel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPanelOpen(false)
        setMobileOpen(false)
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-concrete-200 bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/85">
      <div className="shell flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Logo />

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) =>
              item.hasPanel ? (
                <li key={item.label} className="relative" ref={panelRef}>
                  <button
                    type="button"
                    onClick={() => setPanelOpen((open) => !open)}
                    aria-expanded={panelOpen}
                    aria-controls="catalogue-panel"
                    className={cn(
                      'flex items-center gap-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                      location.pathname.startsWith(paths.products)
                        ? 'text-terracotta'
                        : 'text-charcoal-600 hover:text-charcoal',
                    )}
                  >
                    {item.label}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
                        panelOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {panelOpen && <CataloguePanel onNavigate={() => setPanelOpen(false)} />}
                </li>
              ) : (
                <li key={item.label}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'text-terracotta' : 'text-charcoal-600 hover:text-charcoal',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {hasPhone && telHref && (
            <a
              href={telHref}
              className="flex items-center gap-1.5 rounded-sm px-2.5 py-2 text-sm font-medium text-charcoal-600 transition-colors hover:text-charcoal"
            >
              <Phone aria-hidden="true" className="h-4 w-4" />
              {formatPhone()}
            </a>
          )}
          <WhatsAppButton message={generalEnquiryMessage()} size="sm" />
          <Button to={paths.requestQuote} size="sm">
            Get a Quote
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-sm border border-concrete-300 text-charcoal lg:hidden"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} />}
    </header>
  )
}

/** Desktop catalogue dropdown: the full hierarchy, two clicks from anywhere. */
function CataloguePanel({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div
      id="catalogue-panel"
      className="absolute left-0 top-full z-50 mt-2 w-[720px] border border-concrete-200 bg-cream-100 shadow-lift animate-fade-up"
    >
      <div className="grid grid-cols-3 divide-x divide-concrete-200">
        {productCategories.map((category) => (
          <div key={category.id} className="p-5">
            <Link
              to={categoryUrl(category)}
              onClick={onNavigate}
              className="block rounded-sm font-display text-sm font-extrabold uppercase tracking-[0.08em] text-charcoal hover:text-terracotta"
            >
              {category.name}
            </Link>
            <ul className="mt-3 space-y-1.5">
              {getProductsByCategory(category.id).map((product) => (
                <li key={product.id}>
                  <Link
                    to={productUrl(product)}
                    onClick={onNavigate}
                    className="block rounded-sm py-0.5 text-[13px] text-concrete-700 transition-colors hover:text-charcoal"
                  >
                    {product.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-concrete-200 bg-cream-200 px-5 py-3">
        <div className="flex items-center gap-4">
          <Link
            to={paths.products}
            onClick={onNavigate}
            className="rounded-sm text-[13px] font-semibold text-charcoal hover:text-terracotta"
          >
            View full catalogue
          </Link>
          {activeServices.map((service) => (
            <Link
              key={service.id}
              to={serviceUrl(service)}
              onClick={onNavigate}
              className="rounded-sm text-[13px] font-semibold text-moss-700 hover:text-moss"
            >
              {service.name}
            </Link>
          ))}
        </div>
        <Link
          to={paths.requestQuote}
          onClick={onNavigate}
          className="rounded-sm text-[13px] font-semibold text-terracotta hover:text-terracotta-700"
        >
          Request a quotation →
        </Link>
      </div>
    </div>
  )
}

/**
 * Rendered through a portal on purpose.
 *
 * The header uses `backdrop-blur`, and an ancestor with a backdrop-filter
 * becomes the containing block for `position: fixed` descendants. Rendered
 * inside the header, this panel was being clipped to the 64px header box
 * instead of filling the viewport. Portalling to <body> escapes that.
 */
function MobileMenu({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Opaque and full-screen, so the page behind is invisible — but still
  // tabbable without this.
  useFocusTrap(panelRef, true)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div ref={panelRef} className="fixed inset-0 z-[60] flex flex-col bg-cream lg:hidden">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-concrete-200 px-4">
        <Logo />
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-sm border border-concrete-300 text-charcoal"
          aria-label="Close menu"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-6">
        <p className="eyebrow mb-3">Products</p>
        <ul className="space-y-5">
          {productCategories.map((category) => (
            <li key={category.id}>
              <Link
                to={categoryUrl(category)}
                onClick={onClose}
                className="block rounded-sm font-display text-base font-extrabold uppercase tracking-[0.06em] text-charcoal"
              >
                {category.name}
              </Link>
              <ul className="mt-2 space-y-0.5 border-l border-concrete-300 pl-4">
                {getProductsByCategory(category.id).map((product) => (
                  <li key={product.id}>
                    <Link
                      to={productUrl(product)}
                      onClick={onClose}
                      className="block rounded-sm py-2 text-[15px] text-concrete-700"
                    >
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <p className="eyebrow mb-3 mt-8">Services</p>
        <ul className="space-y-0.5">
          {activeServices.map((service) => (
            <li key={service.id}>
              <Link
                to={serviceUrl(service)}
                onClick={onClose}
                className="block rounded-sm py-2 text-[15px] font-medium text-charcoal"
              >
                {service.name}
              </Link>
            </li>
          ))}
        </ul>

        <p className="eyebrow mb-3 mt-8">Company</p>
        <ul className="space-y-0.5">
          {[
            { label: 'Projects', to: paths.projects },
            { label: 'About Us', to: paths.about },
            { label: 'Contact', to: paths.contact },
          ].map((item) => (
            <li key={item.label}>
              <Link
                to={item.to}
                onClick={onClose}
                className="block rounded-sm py-2 text-[15px] font-medium text-charcoal"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="shrink-0 space-y-2 border-t border-concrete-200 p-4">
        <Button to={paths.requestQuote} size="lg" block>
          Get a Quote
        </Button>
        <WhatsAppButton message={generalEnquiryMessage()} size="lg" tone="outline" block />
      </div>
    </div>,
    document.body,
  )
}
