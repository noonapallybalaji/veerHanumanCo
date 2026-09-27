import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiRequestError, api } from '../lib/api'

/**
 * Admin session state.
 *
 * The session itself lives in an httpOnly cookie the browser sends
 * automatically; this context only mirrors *who* is signed in so the UI can
 * adapt. Hiding a control here is a convenience, never the access control —
 * the server re-checks every permission on every request.
 */

export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  mustResetPassword: boolean
  lastLoginAt: string | null
}

interface AuthState {
  user: AdminUser | null
  permissions: string[]
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ user: AdminUser; permissions: string[] }>('/api/auth/me')
      setUser(data.user)
      setPermissions(data.permissions ?? [])
    } catch {
      // 401 is the normal "not signed in" case, not an error worth surfacing.
      setUser(null)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ user: AdminUser }>('/api/auth/login', { email, password })
    setUser(data.user)
    // Permissions come from /me so the client never infers them from a role.
    const me = await api.get<{ permissions: string[] }>('/api/auth/me')
    setPermissions(me.permissions ?? [])
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      // Already-expired sessions still clear locally.
      if (!(error instanceof ApiRequestError)) throw error
    }
    setUser(null)
    setPermissions([])
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      permissions,
      loading,
      signIn,
      signOut,
      refresh,
      can: (permission: string) => permissions.includes(permission),
    }),
    [user, permissions, loading, signIn, signOut, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
