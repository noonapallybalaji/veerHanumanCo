import { createHash, randomBytes } from 'node:crypto'
import type { Request } from 'express'
import { env } from '../env.js'

/** URL-safe slug. Used for suggestions and to normalise admin-entered slugs. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

/**
 * Finds a free slug by appending -2, -3 ... Used when creating or
 * duplicating content so an admin never hits a raw unique-constraint error.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'item'
  if (!(await exists(root))) return root
  for (let n = 2; n < 200; n += 1) {
    const candidate = `${root}-${n}`
    if (!(await exists(candidate))) return candidate
  }
  return `${root}-${randomBytes(4).toString('hex')}`
}

/**
 * Hashes an IP before storage. Raw addresses are personal data and are
 * never written to the database or the audit log — only this digest, which
 * is enough to correlate abuse without retaining the address itself.
 */
export function hashIp(req: Request): string | null {
  const raw =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress
  if (!raw) return null
  return createHash('sha256').update(`${env.IP_HASH_SALT}:${raw}`).digest('hex').slice(0, 32)
}

/**
 * Reads a route parameter as a string.
 *
 * Express 5 types `req.params` values as `string | string[]` because of
 * wildcard segments. None of our routes use wildcards, so this narrows once
 * here rather than forcing a cast at every call site — and an unexpected
 * array degrades to its first element instead of reaching Prisma as an
 * object and turning into a confusing query error.
 */
export function param(req: Request, name: string): string {
  const value = req.params[name]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export interface PageParams {
  page: number
  perPage: number
  skip: number
  take: number
}

export function pagination(query: Record<string, unknown>, defaultPerPage = 20): PageParams {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1)
  const requested = Number.parseInt(String(query.perPage ?? defaultPerPage), 10) || defaultPerPage
  const perPage = Math.min(100, Math.max(1, requested))
  return { page, perPage, skip: (page - 1) * perPage, take: perPage }
}

export function paged<T>(items: T[], total: number, params: PageParams) {
  return {
    items,
    pagination: {
      page: params.page,
      perPage: params.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.perPage)),
    },
  }
}

/** Shallow before/after diff for the audit log, with secrets stripped. */
const REDACTED_KEYS = new Set(['password', 'passwordHash', 'token', 'secret', 'submitterIpHash'])

export function diff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])

  for (const key of keys) {
    if (REDACTED_KEYS.has(key)) continue
    const from = before?.[key]
    const to = after?.[key]
    if (JSON.stringify(from) === JSON.stringify(to)) continue
    changes[key] = { from: truncate(from), to: truncate(to) }
  }
  return changes
}

/** Keeps the audit log readable and stops it storing whole documents. */
function truncate(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 300) return `${value.slice(0, 300)}…`
  if (value instanceof Date) return value.toISOString()
  return value
}
