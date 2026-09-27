import { ApiRequestError, api } from './api'

/**
 * Enquiry submission.
 *
 * Enquiries are persisted by the CMS API and appear in the admin panel
 * under Enquiries. If the API cannot be reached, the form does NOT claim
 * the message was delivered: it returns 'unavailable' and the UI hands the
 * visitor their formatted requirement to send over WhatsApp instead.
 */

export interface EnquiryItemInput {
  productName: string
  productId?: string
  quantity?: string
  specification?: string
}

export interface EnquiryPayload {
  /** 'quote' from /request-quote, 'contact' from /contact. */
  kind: 'quote' | 'contact'
  name: string
  companyName?: string
  mobile: string
  whatsapp?: string
  email?: string
  product?: string
  quantity?: string
  specification?: string
  projectType?: string
  deliveryLocation?: string
  requirementDate?: string
  message?: string
  submittedAt: string
  sourcePath: string
}

export type EnquiryResult =
  | { status: 'sent'; reference?: string }
  | { status: 'unavailable' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> }

export async function submitEnquiry(payload: EnquiryPayload): Promise<EnquiryResult> {
  const items: EnquiryItemInput[] = payload.product
    ? [
        {
          productName: payload.product,
          quantity: payload.quantity,
          specification: payload.specification,
        },
      ]
    : []

  try {
    const response = await api.post<{ status: string; reference?: string }>(
      '/api/public/enquiries',
      {
        name: payload.name,
        company: payload.companyName ?? '',
        phone: payload.mobile,
        whatsapp: payload.whatsapp ?? '',
        email: payload.email ?? '',
        projectType: payload.projectType ?? '',
        deliveryLocation: payload.deliveryLocation ?? '',
        requirementDate: payload.requirementDate ?? '',
        notes: payload.message ?? '',
        source: payload.sourcePath,
        items,
      },
    )
    return { status: 'sent', reference: response.reference }
  } catch (error) {
    if (error instanceof ApiRequestError) {
      // Validation problems are the visitor's to fix, so surface them.
      if (error.status === 422 || error.status === 400) {
        return {
          status: 'error',
          message: error.message,
          fieldErrors: error.fieldErrors,
        }
      }
      if (error.status === 429) {
        return { status: 'error', message: error.message }
      }
    }
    // Network or server failure: never report success.
    return { status: 'unavailable' }
  }
}

/** Ordered label/value pairs for the WhatsApp message and clipboard copy. */
export function enquiryFields(payload: EnquiryPayload): { label: string; value: string }[] {
  return [
    { label: 'Name', value: payload.name },
    { label: 'Company', value: payload.companyName ?? '' },
    { label: 'Mobile', value: payload.mobile },
    { label: 'Email', value: payload.email ?? '' },
    { label: 'Product', value: payload.product ?? '' },
    { label: 'Quantity', value: payload.quantity ?? '' },
    { label: 'Size / specification', value: payload.specification ?? '' },
    { label: 'Project type', value: payload.projectType ?? '' },
    { label: 'Delivery location', value: payload.deliveryLocation ?? '' },
    { label: 'Required by', value: payload.requirementDate ?? '' },
    { label: 'Additional requirements', value: payload.message ?? '' },
  ]
}

/* --------------------------------------------------------------- *
 * Validation
 * --------------------------------------------------------------- */

export type Errors<T extends string> = Partial<Record<T, string>>

/**
 * Indian mobile numbers: 10 digits starting 6-9.
 *
 * Accepts the same shapes the server accepts — bare 10 digits, a 91 country
 * code, a leading 0, or 091 — because a number the backend would happily
 * normalise must not be rejected by the form first. Keep this in step with
 * `normalisePhone()` in server/src/auth/otp.ts; there is a test asserting
 * the two agree.
 */
export function isValidMobile(value: string): boolean {
  return normaliseIndianMobile(value) !== null
}

/**
 * Returns the 10-digit local number, or null when it is not a valid Indian
 * mobile. Mirrors the server's normalisation rules.
 */
export function normaliseIndianMobile(value: string): string | null {
  const digits = (value ?? '').replace(/[^\d]/g, '')
  if (!digits) return null

  let local = digits
  if (digits.length === 12 && digits.startsWith('91')) local = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) local = digits.slice(1)
  else if (digits.length === 13 && digits.startsWith('091')) local = digits.slice(3)

  return /^[6-9]\d{9}$/.test(local) ? local : null
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}
