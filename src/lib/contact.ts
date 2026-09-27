import { companyConfig } from '../data/company'

/**
 * Contact + WhatsApp helpers.
 *
 * The phone, WhatsApp and email values were NOT supplied, so they are
 * empty placeholders in data/company.ts. Rather than link to an invented
 * number, every call/WhatsApp/email action checks the corresponding
 * `has*` flag below and is simply not rendered while the value is empty.
 *
 * Fill in the three values in data/company.ts and every one of those
 * actions appears across the site with no component changes.
 */

export const hasPhone = companyConfig.phone.trim().length > 0
export const hasWhatsApp = companyConfig.whatsapp.trim().length > 0
export const hasEmail = companyConfig.email.trim().length > 0

/** Digits only, as wa.me and tel: require. */
function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, '')
}

export const telHref = hasPhone ? `tel:+${digitsOnly(companyConfig.phone)}` : undefined
export const emailHref = hasEmail ? `mailto:${companyConfig.email}` : undefined

/** Human-readable phone number, e.g. +91 98765 43210. */
export function formatPhone(value = companyConfig.phone): string {
  const digits = digitsOnly(value)
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return value
}

/**
 * Builds a wa.me link with a prefilled message.
 * Returns undefined when no WhatsApp number is configured, which is the
 * signal for callers not to render the action.
 */
export function whatsAppHref(message: string): string | undefined {
  if (!hasWhatsApp) return undefined
  return `https://wa.me/${digitsOnly(companyConfig.whatsapp)}?text=${encodeURIComponent(message)}`
}

/* ------------------------------------------------------------------ *
 * Message builders — nothing about the product is hardcoded here, the
 * caller passes the name and category straight from the data layer.
 * ------------------------------------------------------------------ */

export function productEnquiryMessage(productName: string, categoryName: string): string {
  return [
    'Hello, I am interested in:',
    '',
    `Product: ${productName}`,
    `Category: ${categoryName}`,
    '',
    'Please share availability, specifications and quotation.',
  ].join('\n')
}

export function serviceEnquiryMessage(serviceName: string): string {
  return [
    'Hello, I would like to discuss:',
    '',
    `Service: ${serviceName}`,
    '',
    'Please share details of scope and how we can take this forward.',
  ].join('\n')
}

export function generalEnquiryMessage(): string {
  return [
    `Hello ${companyConfig.companyName},`,
    '',
    'I have a project requirement and would like to discuss products and quotation.',
  ].join('\n')
}

export function requirementEnquiryMessage(requirementName: string): string {
  return [
    'Hello, I have a requirement for:',
    '',
    `Requirement: ${requirementName}`,
    '',
    'Please suggest suitable products and share a quotation.',
  ].join('\n')
}

/** Formats a submitted quote enquiry so it can be sent over WhatsApp. */
export function quoteEnquiryMessage(fields: { label: string; value: string }[]): string {
  const filled = fields.filter((field) => field.value.trim().length > 0)
  return [
    `Hello ${companyConfig.companyName}, here is my requirement:`,
    '',
    ...filled.map((field) => `${field.label}: ${field.value}`),
    '',
    'Please share a quotation.',
  ].join('\n')
}

export const fullAddressLines = [
  ...companyConfig.address.lines,
  `${companyConfig.address.city} – ${companyConfig.address.postalCode}`,
  `${companyConfig.address.state}, ${companyConfig.address.country}`,
]

export const singleLineAddress = fullAddressLines.join(', ')
