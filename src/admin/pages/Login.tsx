import { CircleAlert, Loader } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '../../lib/api'
import { useAuth } from '../AuthContext'

const darkInput =
  'w-full rounded-sm border border-cream/20 bg-charcoal px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-1 focus-visible:ring-offset-charcoal-800'

/**
 * Admin sign-in.
 *
 * The form shows whatever the server says and nothing more: the API returns
 * one generic message for unknown email, wrong password and disabled
 * account, so this page cannot be used to discover which admin addresses
 * exist.
 */
export default function AdminLogin() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/admin" replace />

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      navigate('/admin', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : 'Could not reach the server. Check your connection and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4 py-12 on-dark">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-sm bg-terracotta font-display text-base font-extrabold text-white"
          >
            VH
          </span>
          <h1 className="text-2xl text-cream">Veer Hanuman Admin</h1>
          <p className="mt-1.5 text-[13.5px] text-cream/55">
            Sign in to manage the website content.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 border border-cream/15 bg-charcoal-800 p-6"
          noValidate
        >
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 border border-terracotta/40 bg-terracotta/10 p-3 text-[13px] text-cream"
            >
              <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-400" />
              {error}
            </p>
          )}

          {/* Plain labels rather than the shared <Labelled>, whose text
              colour is tuned for the light admin surfaces. */}
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-cream">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={darkInput}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-cream">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={darkInput}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-sm bg-terracotta px-4 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600 disabled:opacity-60"
          >
            {busy && <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-[12.5px] leading-relaxed text-cream/40">
          No account yet? Create the first one on the server with
          <code className="mx-1 font-mono text-cream/60">npm run admin:create</code>
        </p>
      </div>
    </div>
  )
}
