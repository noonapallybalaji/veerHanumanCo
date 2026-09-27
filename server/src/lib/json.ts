/**
 * Helpers for the JSON-in-TEXT columns.
 *
 * Prisma has no Json type on SQLite, so structured fields are stored as
 * strings. Everything reading them goes through `parseJson`, which never
 * throws: a corrupt or hand-edited row degrades to the fallback instead of
 * taking down a page.
 */

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}

export function parseArray<T>(value: string | null | undefined): T[] {
  const parsed = parseJson<T[]>(value, [])
  return Array.isArray(parsed) ? parsed : []
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null)
}

export interface SpecificationRow {
  label: string
  value: string
}

export interface ScopeRow {
  title: string
  detail: string
}

export interface BusinessHoursRow {
  days: string
  hours: string
}

export interface SocialLink {
  platform: string
  url: string
}
