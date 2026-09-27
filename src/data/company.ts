import type { AdditionalOffering, CompanyConfig } from './types'

/**
 * SEED AND OFFLINE FALLBACK for company details.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ AT RUNTIME this object is overwritten in place with the CMS      │
 * │ company profile by src/content/store.ts. Change the live details │
 * │ in the admin panel under Contact Settings, not here.             │
 * └──────────────────────────────────────────────────────────────────┘
 * Every header, footer, contact block, WhatsApp link and schema.org block
 * reads from here. Nothing is hardcoded in components.
 *
 * ------------------------------------------------------------------
 * ACTION REQUIRED BY THE BUSINESS OWNER
 * ------------------------------------------------------------------
 * 1. `phone` and `email` are PLACEHOLDERS. They were not supplied and
 *    must not be invented. Until they are filled in, the UI hides the
 *    call and email actions instead of linking somewhere wrong (see
 *    lib/contact.ts). `whatsapp` has been confirmed by the owner.
 * 2. `proprietor`, `gstin`, turnover and employee count came from
 *    third-party business directories. They stay hidden until the
 *    matching `disclosure` flag below is set to `true`.
 * 3. `siteUrl` is blank because the production domain has not been
 *    confirmed. Set it in the admin panel (Company & Contact) before launch —
 *    canonical URLs, Open Graph tags and sitemap.xml all derive from it.
 *    Until then pages use the origin they are served from (lib/site.ts) and
 *    /sitemap.xml returns 503 rather than publishing guessed URLs.
 */
export const companyConfig: CompanyConfig = {
  companyName: 'Veer Hanuman Trading Co.',
  alternateName: 'Veer Hanuman Traders',
  proprietor: 'R. Kumawat',
  establishedYear: 2016,
  businessStructure: 'Proprietorship',
  natureOfBusiness: ['Wholesaler', 'Retailer', 'Manufacturer', 'Contractor'],
  gstin: '36CVMPK9596C1ZY',

  /* ------------------------------------------------------------------
   * Contact channels. Digits only, country code first, no "+" or spaces.
   *
   * `whatsapp` was confirmed by the owner: 8712002048, stored with the
   * 91 country code because wa.me and tel: both require it.
   *
   * `phone` and `email` are still PLACEHOLDERS — not supplied, and not
   * assumed to be the same as the WhatsApp number. While they are empty
   * the call and email actions are hidden rather than pointing somewhere
   * wrong. Filling them in switches on, all at once: the top bar
   * phone/email, the header call link, the contact page rows, the mobile
   * Call button and the telephone/email fields in the LocalBusiness
   * schema.
   * ------------------------------------------------------------------ */
  phone: '',
  whatsapp: '918712002048',
  email: '',

  address: {
    label: 'Office',
    lines: [
      'Flat No. 118, Bhanu Enclave, 2nd Floor',
      'Above Maruthi Showroom, Near ESI Hospital',
      'Sunder Nagar Colony, Erragadda',
    ],
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500018',
    country: 'India',
    isPublished: true,
  },

  /**
   * Reported as an additional / warehousing location by third-party sources.
   * Gated behind `disclosure.showWarehouseAddress`.
   */
  warehouseAddress: {
    label: 'Additional location',
    lines: ['Laxmi Nagar Colony', 'Gundla Pochampally'],
    city: 'Rangareddy',
    state: 'Telangana',
    postalCode: '501401',
    country: 'India',
    isPublished: false,
  },

  businessHours: [
    { days: 'Monday – Saturday', hours: '9:30 AM – 6:00 PM' },
    { days: 'Sunday', hours: 'Closed' },
  ],

  siteUrl: '',

  disclosure: {
    showProprietor: false,
    showGstin: false,
    showTurnover: false,
    showEmployeeCount: false,
    showWarehouseAddress: false,
  },
}

/**
 * Third-party directory listings associate the name "Veer Hanuman
 * Traders / Trading Co." with the categories below. Several of those
 * listings appear to belong to *different* businesses in Mancherial,
 * Haryana and Rajasthan, so none of it is published.
 *
 * Nothing here is rendered while `status` is 'confirmation_required', and
 * `status` itself is never shown to a visitor. To publish an offering:
 * set `status: 'confirmed'` — it then appears in the "Also available"
 * block on /products and /services.
 *
 * Deliberately NOT imported from those listings: reviews, star ratings,
 * photographs, customer comments and any performance claims.
 */
export const additionalOfferings: AdditionalOffering[] = [
  {
    id: 'ao-coal',
    name: 'Coal / Charcoal',
    type: 'product',
    status: 'confirmation_required',
    source: 'Third-party business directory listing',
    note: 'Coal and charcoal supply for industrial requirements.',
  },
  {
    id: 'ao-coal-tar',
    name: 'Coal Tar / STP Products',
    type: 'product',
    status: 'confirmation_required',
    source: 'Third-party business directory listing',
    note: 'Coal tar and STP coal tar products, including wholesale quantities.',
  },
  {
    id: 'ao-white-coal',
    name: 'White Coal',
    type: 'product',
    status: 'confirmation_required',
    source: 'Third-party business directory listing',
    note: 'White coal (biomass briquette) supply.',
  },
  {
    id: 'ao-granite-tiles',
    name: 'Granite & Tiles',
    type: 'product',
    status: 'confirmation_required',
    source: 'Third-party search results for similarly named businesses',
    note: 'Granite, ceramic and vitrified tiles for construction projects.',
  },
  {
    id: 'ao-paver-fixing',
    name: 'Paver Block Fixing',
    type: 'service',
    status: 'confirmation_required',
    source: 'Third-party search results for similarly named businesses',
    note: 'Paver block laying and fixing for outdoor and roadway areas.',
  },
  {
    id: 'ao-tile-fixing',
    name: 'Tile Fixing',
    type: 'service',
    status: 'confirmation_required',
    source: 'Third-party search results for similarly named businesses',
    note: 'Tile fixing for interior and exterior applications.',
  },
]

/** Only offerings the owner has confirmed are ever rendered. */
export const confirmedAdditionalOfferings = additionalOfferings.filter(
  (offering) => offering.status === 'confirmed',
)
