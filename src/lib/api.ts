/**
 * Browser API client.
 *
 * Auth is a httpOnly cookie, so nothing here stores a token — every request
 * just sends credentials. Writes echo the CSRF cookie back in a header,
 * which is the half of the double-submit check a cross-site page cannot
 * perform.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export function apiUrl(path: string): string {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Turns a stored media path into an absolute URL when the API lives on a
 * different origin, so <img src> works in development too.
 */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path) || path.startsWith('data:')) return path
  return path.startsWith('/api/') ? apiUrl(path) : path
}

export interface ApiErrorDetail {
  field: string
  message: string
}

export class ApiRequestError extends Error {
  // Declared as fields rather than constructor parameter properties, which
  // the app's `erasableSyntaxOnly` setting disallows.
  readonly status: number
  readonly code: string
  readonly details?: ApiErrorDetail[] | unknown

  constructor(status: number, code: string, message: string, details?: ApiErrorDetail[] | unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** Field-keyed messages, for wiring straight into form state. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {}
    const out: Record<string, string> = {}
    for (const detail of this.details as ApiErrorDetail[]) {
      if (detail?.field && !out[detail.field]) out[detail.field] = detail.message
    }
    return out
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** Set for multipart uploads, where the browser must set the boundary. */
  formData?: FormData
  signal?: AbortSignal
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {}

  if (method !== 'GET') {
    /*
     * Two independent CSRF tokens, sent on their own headers. The admin and
     * visitor sessions are separate on the server, so their tokens must not
     * be interchangeable here either. Sending whichever cookies exist is
     * harmless: each endpoint checks only the one it cares about.
     */
    const adminCsrf = readCookie('vh_csrf')
    if (adminCsrf) headers['X-CSRF-Token'] = adminCsrf

    const customerCsrf = readCookie('vh_customer_csrf')
    if (customerCsrf) headers['X-Customer-CSRF-Token'] = customerCsrf
  }
  if (options.body !== undefined && !options.formData) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(apiUrl(path), {
    method,
    headers,
    credentials: 'include',
    signal: options.signal,
    body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  })

  if (response.status === 204) return undefined as T

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text()

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.details,
    )
  }

  return payload as T
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', formData }),
}
