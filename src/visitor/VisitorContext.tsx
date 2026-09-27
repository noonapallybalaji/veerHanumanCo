import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../lib/api'

/**
 * Visitor (customer) session state.
 *
 * Mirrors what the server already knows. Nothing here is authoritative:
 * `phoneVerified` is a hint for rendering, and the server re-checks its own
 * session cookie on every write. A tampered value in this context cannot
 * get an enquiry saved.
 */

export interface Visitor {
  id: string
  name: string
  phone: string
  email: string
  company: string
  phoneVerified: boolean
  marketingConsent: boolean
}

export interface OtpCapability {
  otpAvailable: boolean
  otpLength: number
  resendCooldownSeconds: number
  codeTtlSeconds: number
}

interface VisitorState {
  visitor: Visitor | null
  capability: OtpCapability | null
  loading: boolean
  /** Called after a successful verification to adopt the new session. */
  setVisitor: (visitor: Visitor | null) => void
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const VisitorContext = createContext<VisitorState | null>(null)

export function VisitorProvider({ children }: { children: ReactNode }) {
  const [visitor, setVisitor] = useState<Visitor | null>(null)
  const [capability, setCapability] = useState<OtpCapability | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ customer: Visitor | null }>('/api/visitor/me')
      setVisitor(data.customer)
    } catch {
      // Anonymous, or the API is unreachable. Either way there is no session.
      setVisitor(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    api
      .get<OtpCapability>('/api/visitor/capability')
      .then(setCapability)
      // Treat an unreachable API as "verification unavailable", which makes
      // the forms say so rather than fail confusingly at submit time.
      .catch(() =>
        setCapability({
          otpAvailable: false,
          otpLength: 6,
          resendCooldownSeconds: 45,
          codeTtlSeconds: 300,
        }),
      )
  }, [refresh])

  const signOut = useCallback(async () => {
    try {
      await api.post('/api/visitor/logout')
    } catch {
      // Clearing locally is still correct if the call fails.
    }
    setVisitor(null)
  }, [])

  const value = useMemo<VisitorState>(
    () => ({ visitor, capability, loading, setVisitor, refresh, signOut }),
    [visitor, capability, loading, refresh, signOut],
  )

  return <VisitorContext.Provider value={value}>{children}</VisitorContext.Provider>
}

export function useVisitor(): VisitorState {
  const context = useContext(VisitorContext)
  if (!context) throw new Error('useVisitor must be used inside <VisitorProvider>')
  return context
}
