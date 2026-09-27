import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from './Footer'
import { Header } from './Header'
import { MobileActionBar } from './MobileActionBar'
import { TopBar } from './TopBar'
import { FloatingWhatsApp } from './FloatingWhatsApp'
import { WelcomeModal } from '../../visitor/WelcomeModal'

/** Scrolls to the top on navigation, but honours in-page hash links. */
function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const target = document.querySelector(hash)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, hash])

  return null
}

export function Layout() {
  return (
    <>
      <ScrollManager />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <TopBar />
      <Header />
      {/* Bottom padding clears the fixed mobile action bar. */}
      <main id="main" className="pb-[76px] lg:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileActionBar />
      {/* Renders nothing unless a WhatsApp number is configured in the CMS. */}
      <FloatingWhatsApp />
      {/* Shown once per browser session, and entirely skippable. */}
      <WelcomeModal />
    </>
  )
}
