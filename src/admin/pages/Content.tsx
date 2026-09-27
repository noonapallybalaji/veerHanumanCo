import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiRequestError, api } from '../../lib/api'
import { useAuth } from '../AuthContext'
import { PageTitle } from '../components/AdminLayout'
import {
  AdminButton,
  AdminPanel,
  ErrorState,
  Labelled,
  LoadingState,
  StatusBadge,
  formatDateTime,
  inputClass,
  useToast,
} from '../components/ui'

interface Section {
  id: string
  type: string
  enabled: boolean
  displayOrder: number
  data: Record<string, string | number | boolean | string[]>
}

interface PageData {
  id: string
  key: string
  title: string
  status: string
  seoTitle: string
  seoDescription: string
  updatedAt: string
  sections: Section[]
}

/** Human labels for the predefined section types. */
const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero banner',
  categories: 'Product families',
  requirementFinder: 'Requirement finder',
  applications: 'Applications',
  whyUs: 'Why choose us',
  featuredProducts: 'Featured products',
  landscaping: 'Landscaping teaser',
  projects: 'Projects teaser',
  quoteCta: 'Quote call to action',
  intro: 'Introduction',
  overview: 'Company overview',
  story: 'Company story',
  capabilities: 'Capabilities',
  values: 'Values',
  customers: 'Who we work with',
  businessDetails: 'Business details panel',
}

/** Friendly labels for the free-text fields inside a section. */
const FIELD_LABELS: Record<string, string> = {
  eyebrow: 'Small label above the heading',
  title: 'Heading',
  titleAccent: 'Second heading line',
  intro: 'Intro paragraph',
  description: 'Description',
  body: 'Body text',
  primaryCtaLabel: 'Primary button label',
  primaryCtaHref: 'Primary button link',
  secondaryCtaLabel: 'Secondary button label',
  secondaryCtaHref: 'Secondary button link',
  items: 'List items',
}

/**
 * Homepage and About editor.
 *
 * Editors fill typed fields on predefined sections and can reorder or switch
 * them off. There is deliberately no rich-text or raw-HTML input: arbitrary
 * markup from the admin panel would be a stored-XSS hole on every public
 * page, and the server rejects unknown section types as well.
 */
export default function AdminContent() {
  const [params, setParams] = useSearchParams()
  const pageKey = params.get('page') ?? 'home'
  const [page, setPage] = useState<PageData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { can } = useAuth()
  const { push } = useToast()
  const readOnly = !can('content:write')

  const load = useCallback(async () => {
    setError(null)
    setPage(null)
    try {
      const response = await api.get<{ page: PageData }>(`/api/admin/settings/pages/${pageKey}`)
      setPage(response.page)
    } catch (caught) {
      setError((caught as Error).message)
    }
  }, [pageKey])

  useEffect(() => {
    void load()
  }, [load])

  function updateSection(index: number, patch: Partial<Section>) {
    setPage((current) => {
      if (!current) return current
      const sections = [...current.sections]
      sections[index] = { ...sections[index], ...patch }
      return { ...current, sections }
    })
  }

  function move(index: number, direction: -1 | 1) {
    setPage((current) => {
      if (!current) return current
      const target = index + direction
      if (target < 0 || target >= current.sections.length) return current
      const sections = [...current.sections]
      ;[sections[index], sections[target]] = [sections[target], sections[index]]
      return { ...current, sections }
    })
  }

  async function save() {
    if (!page) return
    setSaving(true)
    try {
      await api.put(`/api/admin/settings/pages/${pageKey}`, {
        title: page.title,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        sections: page.sections.map((section) => ({
          type: section.type,
          enabled: section.enabled,
          data: section.data,
        })),
      })
      push('success', 'Page content saved.')
      await load()
    } catch (caught) {
      push('error', caught instanceof ApiRequestError ? caught.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitle
        title="Website content"
        description="Edit the wording of the homepage and About page. Layout and design stay fixed so the pages cannot be broken by accident."
        actions={
          <div className="flex items-center gap-2">
            {page && <StatusBadge status={page.status} />}
            {!readOnly && page && (
              <AdminButton onClick={save} busy={saving}>
                Save changes
              </AdminButton>
            )}
          </div>
        }
      />

      <div className="mb-4 flex gap-1.5 border-b border-concrete-200 pb-3">
        {[
          { value: 'home', label: 'Homepage' },
          { value: 'about', label: 'About page' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setParams({ page: tab.value }, { replace: true })}
            className={`inline-flex min-h-[36px] items-center rounded-sm px-3 text-[13px] font-semibold transition-colors ${
              pageKey === tab.value
                ? 'bg-charcoal text-cream'
                : 'text-concrete-700 hover:bg-charcoal/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !page && <LoadingState label="Loading page content" />}

      {page && (
        <div className="space-y-5">
          <AdminPanel
            title="Search engine listing"
            description={`Last saved ${formatDateTime(page.updatedAt)}.`}
          >
            <div className="grid gap-4">
              <Labelled label="SEO title">
                <input
                  value={page.seoTitle}
                  onChange={(event) => setPage({ ...page, seoTitle: event.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Meta description">
                <textarea
                  rows={3}
                  value={page.seoDescription}
                  onChange={(event) => setPage({ ...page, seoDescription: event.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
            </div>
          </AdminPanel>

          <p className="flex items-start gap-2 border border-concrete-200 bg-cream-100 p-4 text-[13px] leading-relaxed text-concrete-700">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-concrete" />
            Leave a field blank to use the wording that ships with the design. Switching a section
            off removes it from the page.
          </p>

          {page.sections.map((section, index) => (
            <AdminPanel
              key={section.id || `${section.type}-${index}`}
              title={SECTION_LABELS[section.type] ?? section.type}
              actions={
                !readOnly && (
                  <div className="flex items-center gap-1.5">
                    <AdminButton
                      size="sm"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp aria-hidden="true" className="h-4 w-4" />
                      <span className="sr-only">Move up</span>
                    </AdminButton>
                    <AdminButton
                      size="sm"
                      variant="ghost"
                      disabled={index === page.sections.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown aria-hidden="true" className="h-4 w-4" />
                      <span className="sr-only">Move down</span>
                    </AdminButton>
                    <label className="ml-2 flex items-center gap-2 text-[13px] text-charcoal">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) => updateSection(index, { enabled: event.target.checked })}
                        className="h-4 w-4"
                      />
                      Shown
                    </label>
                  </div>
                )
              }
            >
              {Object.keys(section.data).length === 0 ? (
                <p className="text-[13px] text-concrete-700">
                  This section has no editable text — it renders from the catalogue.
                </p>
              ) : (
                <div className="grid gap-4">
                  {Object.entries(section.data).map(([field, value]) => (
                    <Labelled key={field} label={FIELD_LABELS[field] ?? field}>
                      {Array.isArray(value) ? (
                        <textarea
                          rows={Math.min(10, value.length + 1)}
                          value={value.join('\n')}
                          onChange={(event) =>
                            updateSection(index, {
                              data: {
                                ...section.data,
                                [field]: event.target.value.split('\n').filter(Boolean),
                              },
                            })
                          }
                          disabled={readOnly}
                          className={inputClass}
                        />
                      ) : typeof value === 'string' && value.length > 90 ? (
                        <textarea
                          rows={4}
                          value={value}
                          onChange={(event) =>
                            updateSection(index, {
                              data: { ...section.data, [field]: event.target.value },
                            })
                          }
                          disabled={readOnly}
                          className={inputClass}
                        />
                      ) : (
                        <input
                          value={String(value)}
                          onChange={(event) =>
                            updateSection(index, {
                              data: { ...section.data, [field]: event.target.value },
                            })
                          }
                          disabled={readOnly}
                          className={inputClass}
                        />
                      )}
                    </Labelled>
                  ))}
                </div>
              )}
            </AdminPanel>
          ))}
        </div>
      )}
    </>
  )
}
