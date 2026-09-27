import { Info, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ApiRequestError, api } from '../../lib/api'
import { useAuth } from '../AuthContext'
import { PageTitle } from '../components/AdminLayout'
import {
  AdminButton,
  AdminPanel,
  ErrorState,
  Labelled,
  LoadingState,
  formatDateTime,
  inputClass,
  useToast,
} from '../components/ui'

interface CompanyForm {
  companyName: string
  alternateName: string
  proprietor: string
  establishedYear: number | null
  businessStructure: string
  natureOfBusiness: string[]
  gstin: string
  phone: string
  whatsapp: string
  email: string
  addressLabel: string
  addressLines: string[]
  city: string
  state: string
  postalCode: string
  country: string
  warehouseLabel: string
  warehouseLines: string[]
  warehouseCity: string
  warehouseState: string
  warehousePostalCode: string
  businessHours: { days: string; hours: string }[]
  mapsUrl: string
  socialLinks: { platform: string; url: string }[]
  siteUrl: string
  showProprietor: boolean
  showGstin: boolean
  showWarehouseAddress: boolean
}

interface Offering {
  id: string
  name: string
  type: string
  status: string
  source: string
  note: string
}

/**
 * Company profile and contact settings.
 *
 * This is the single place contact details are edited. The header, top bar,
 * footer, contact page, mobile action bar, WhatsApp links and the
 * LocalBusiness schema all read the same record, so one change propagates
 * everywhere on the next page load.
 */
export default function AdminCompany() {
  const [form, setForm] = useState<CompanyForm | null>(null)
  const [offerings, setOfferings] = useState<Offering[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { can } = useAuth()
  const { push } = useToast()
  const readOnly = !can('company:write')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [company, offeringResponse] = await Promise.all([
        api.get<{ company: Record<string, never> }>('/api/admin/settings/company'),
        api.get<{ offerings: Offering[] }>('/api/admin/settings/offerings'),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = company.company as any
      setForm({
        companyName: data.companyName ?? '',
        alternateName: data.alternateName ?? '',
        proprietor: data.proprietor ?? '',
        establishedYear: data.establishedYear ?? null,
        businessStructure: data.businessStructure ?? '',
        natureOfBusiness: data.natureOfBusiness ?? [],
        gstin: data.gstin ?? '',
        phone: data.phone ?? '',
        whatsapp: data.whatsapp ?? '',
        email: data.email ?? '',
        addressLabel: data.address?.label ?? 'Office',
        addressLines: data.address?.lines ?? [],
        city: data.address?.city ?? '',
        state: data.address?.state ?? '',
        postalCode: data.address?.postalCode ?? '',
        country: data.address?.country ?? 'India',
        warehouseLabel: data.warehouseAddress?.label ?? 'Additional location',
        warehouseLines: data.warehouseAddress?.lines ?? [],
        warehouseCity: data.warehouseAddress?.city ?? '',
        warehouseState: data.warehouseAddress?.state ?? '',
        warehousePostalCode: data.warehouseAddress?.postalCode ?? '',
        businessHours: data.businessHours ?? [],
        mapsUrl: data.mapsUrl ?? '',
        socialLinks: data.socialLinks ?? [],
        siteUrl: data.siteUrl ?? '',
        showProprietor: Boolean(data.disclosure?.showProprietor),
        showGstin: Boolean(data.disclosure?.showGstin),
        showWarehouseAddress: Boolean(data.disclosure?.showWarehouseAddress),
      })
      setUpdatedAt(data.updatedAt ?? null)
      setOfferings(offeringResponse.offerings)
    } catch (caught) {
      setError((caught as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const set = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current))

  async function save() {
    if (!form) return
    setSaving(true)
    setFieldErrors({})
    try {
      await api.put('/api/admin/settings/company', form)
      push('success', 'Company details saved. The website picks them up on the next page load.')
      await load()
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setFieldErrors(caught.fieldErrors)
        push('error', caught.message)
      } else {
        push('error', 'Could not save.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function setOfferingStatus(offering: Offering, status: string) {
    try {
      await api.put(`/api/admin/settings/offerings/${offering.id}`, { status })
      push(
        'success',
        status === 'CONFIRMED'
          ? `"${offering.name}" is now shown publicly.`
          : `"${offering.name}" is hidden from the website.`,
      )
      await load()
    } catch (caught) {
      push('error', (caught as Error).message)
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!form) return <LoadingState label="Loading company profile" />

  return (
    <>
      <PageTitle
        title="Company & contact"
        description={
          updatedAt
            ? `One place for every contact detail on the website. Last saved ${formatDateTime(updatedAt)}.`
            : 'One place for every contact detail on the website.'
        }
        actions={
          !readOnly && (
            <AdminButton onClick={save} busy={saving}>
              Save changes
            </AdminButton>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminPanel
          title="Contact details"
          description="Leave a field blank and the matching action is hidden on the website rather than linking somewhere wrong."
        >
          <div className="grid gap-4">
            <Labelled label="Phone" hint="digits, country code first" error={fieldErrors.phone}>
              <input
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
                placeholder="919876543210"
                disabled={readOnly}
                className={inputClass}
              />
            </Labelled>
            <Labelled label="WhatsApp number" error={fieldErrors.whatsapp}>
              <input
                value={form.whatsapp}
                onChange={(event) => set('whatsapp', event.target.value)}
                placeholder="919876543210"
                disabled={readOnly}
                className={inputClass}
              />
            </Labelled>
            <Labelled label="Public email" error={fieldErrors.email}>
              <input
                value={form.email}
                onChange={(event) => set('email', event.target.value)}
                disabled={readOnly}
                className={inputClass}
              />
            </Labelled>
            <Labelled label="Production website URL" hint="used for canonical links and the sitemap" error={fieldErrors.siteUrl}>
              <input
                value={form.siteUrl}
                onChange={(event) => set('siteUrl', event.target.value)}
                disabled={readOnly}
                className={inputClass}
              />
            </Labelled>
            <Labelled label="Google Maps link" error={fieldErrors.mapsUrl}>
              <input
                value={form.mapsUrl}
                onChange={(event) => set('mapsUrl', event.target.value)}
                placeholder="https://maps.google.com/..."
                disabled={readOnly}
                className={inputClass}
              />
            </Labelled>
          </div>
        </AdminPanel>

        <AdminPanel title="Business identity">
          <div className="grid gap-4">
            <Labelled label="Company name" required error={fieldErrors.companyName}>
              <input
                value={form.companyName}
                onChange={(event) => set('companyName', event.target.value)}
                disabled={readOnly}
                className={inputClass}
              />
            </Labelled>
            <Labelled label="Also known as">
              <input
                value={form.alternateName}
                onChange={(event) => set('alternateName', event.target.value)}
                disabled={readOnly}
                className={inputClass}
              />
            </Labelled>
            <div className="grid gap-4 sm:grid-cols-2">
              <Labelled label="Established year" error={fieldErrors.establishedYear}>
                <input
                  type="number"
                  value={form.establishedYear ?? ''}
                  onChange={(event) =>
                    set('establishedYear', event.target.value ? Number(event.target.value) : null)
                  }
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Business structure">
                <input
                  value={form.businessStructure}
                  onChange={(event) => set('businessStructure', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
            </div>
            <ListEditor
              label="Nature of business"
              values={form.natureOfBusiness}
              onChange={(values) => set('natureOfBusiness', values)}
              disabled={readOnly}
              placeholder="e.g. Wholesaler"
            />
          </div>
        </AdminPanel>

        <AdminPanel title="Office address">
          <div className="grid gap-4">
            <ListEditor
              label="Address lines"
              values={form.addressLines}
              onChange={(values) => set('addressLines', values)}
              disabled={readOnly}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Labelled label="City">
                <input
                  value={form.city}
                  onChange={(event) => set('city', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="State">
                <input
                  value={form.state}
                  onChange={(event) => set('state', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Postal code">
                <input
                  value={form.postalCode}
                  onChange={(event) => set('postalCode', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Country">
                <input
                  value={form.country}
                  onChange={(event) => set('country', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel title="Business hours">
          <div className="space-y-2">
            {form.businessHours.map((row, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={row.days}
                  placeholder="Monday - Saturday"
                  onChange={(event) => {
                    const next = [...form.businessHours]
                    next[index] = { ...row, days: event.target.value }
                    set('businessHours', next)
                  }}
                  disabled={readOnly}
                  className={`${inputClass} flex-1`}
                />
                <input
                  value={row.hours}
                  placeholder="9:30 AM - 6:00 PM"
                  onChange={(event) => {
                    const next = [...form.businessHours]
                    next[index] = { ...row, hours: event.target.value }
                    set('businessHours', next)
                  }}
                  disabled={readOnly}
                  className={`${inputClass} flex-1`}
                />
                {!readOnly && (
                  <AdminButton
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      set('businessHours', form.businessHours.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    <span className="sr-only">Remove row</span>
                  </AdminButton>
                )}
              </div>
            ))}
            {!readOnly && (
              <AdminButton
                size="sm"
                variant="secondary"
                onClick={() => set('businessHours', [...form.businessHours, { days: '', hours: '' }])}
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                Add row
              </AdminButton>
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          title="Details requiring confirmation"
          description="These came from third-party business directories. They stay off the website until you switch them on."
          className="lg:col-span-2"
        >
          <p className="mb-4 flex items-start gap-2 border border-concrete-200 bg-cream p-3 text-[13px] leading-relaxed text-concrete-700">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-concrete" />
            Only switch a toggle on once you have confirmed the detail is correct and you are happy
            for it to be public.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Labelled label="Proprietor name">
                <input
                  value={form.proprietor}
                  onChange={(event) => set('proprietor', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Labelled>
              <Toggle
                label="Show the proprietor name publicly"
                checked={form.showProprietor}
                onChange={(checked) => set('showProprietor', checked)}
                disabled={readOnly}
              />
            </div>
            <div>
              <Labelled label="GSTIN" error={fieldErrors.gstin}>
                <input
                  value={form.gstin}
                  onChange={(event) => set('gstin', event.target.value.toUpperCase())}
                  disabled={readOnly}
                  className={`${inputClass} font-mono`}
                />
              </Labelled>
              <Toggle
                label="Show the GSTIN publicly"
                checked={form.showGstin}
                onChange={(checked) => set('showGstin', checked)}
                disabled={readOnly}
              />
            </div>
            <div className="sm:col-span-2">
              <ListEditor
                label="Additional / warehouse address"
                values={form.warehouseLines}
                onChange={(values) => set('warehouseLines', values)}
                disabled={readOnly}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input
                  value={form.warehouseCity}
                  placeholder="City"
                  onChange={(event) => set('warehouseCity', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
                <input
                  value={form.warehouseState}
                  placeholder="State"
                  onChange={(event) => set('warehouseState', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
                <input
                  value={form.warehousePostalCode}
                  placeholder="Postal code"
                  onChange={(event) => set('warehousePostalCode', event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </div>
              <Toggle
                label="Show the additional address publicly"
                checked={form.showWarehouseAddress}
                onChange={(checked) => set('showWarehouseAddress', checked)}
                disabled={readOnly}
              />
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          title="Additional offerings"
          description="Reported by third-party directories, some of which appear to belong to different businesses of a similar name. Nothing here is public until you confirm it."
          className="lg:col-span-2"
        >
          <ul className="divide-y divide-concrete-200">
            {offerings.map((offering) => (
              <li key={offering.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-charcoal">
                    {offering.name}
                    <span className="ml-2 text-[11.5px] font-normal uppercase tracking-[0.08em] text-concrete">
                      {offering.type}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-concrete-700">{offering.note}</p>
                  <p className="mt-0.5 text-[11.5px] italic text-concrete">Source: {offering.source}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${
                      offering.status === 'CONFIRMED'
                        ? 'border-moss/30 bg-moss-100 text-moss-700'
                        : 'border-concrete-300 bg-cream-200 text-concrete-700'
                    }`}
                  >
                    {offering.status === 'CONFIRMED' ? 'Public' : 'Not published'}
                  </span>
                  {!readOnly && (
                    <AdminButton
                      size="sm"
                      variant={offering.status === 'CONFIRMED' ? 'secondary' : 'primary'}
                      onClick={() =>
                        setOfferingStatus(
                          offering,
                          offering.status === 'CONFIRMED' ? 'CONFIRMATION_REQUIRED' : 'CONFIRMED',
                        )
                      }
                    >
                      {offering.status === 'CONFIRMED' ? 'Hide' : 'Confirm & publish'}
                    </AdminButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </AdminPanel>
      </div>
    </>
  )
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="mt-2.5 flex items-center gap-2 text-[13px] text-charcoal">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="h-4 w-4"
      />
      {label}
    </label>
  )
}

function ListEditor({
  label,
  values,
  onChange,
  disabled,
  placeholder,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold text-charcoal">{label}</span>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={value}
              placeholder={placeholder}
              onChange={(event) => {
                const next = [...values]
                next[index] = event.target.value
                onChange(next)
              }}
              disabled={disabled}
              className={`${inputClass} flex-1`}
            />
            {!disabled && (
              <AdminButton
                size="sm"
                variant="ghost"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="sr-only">Remove line {index + 1}</span>
              </AdminButton>
            )}
          </div>
        ))}
        {!disabled && (
          <AdminButton size="sm" variant="secondary" onClick={() => onChange([...values, ''])}>
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add line
          </AdminButton>
        )}
      </div>
    </div>
  )
}
