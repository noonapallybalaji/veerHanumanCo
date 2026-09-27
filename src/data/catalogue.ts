import type { Product, ProductCategory, ProductDivision, Service } from './types'

/**
 * THE INITIAL CATALOGUE — SEED AND OFFLINE FALLBACK.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ AT RUNTIME THESE ARRAYS ARE REPLACED IN PLACE with published CMS │
 * │ content by src/content/store.ts. Editing this file changes the   │
 * │ seed and the offline fallback, NOT the live site — manage live   │
 * │ content in the admin panel at /admin.                            │
 * │                                                                  │
 * │ It is also what `npm run db:seed` inserts, so it stays the       │
 * │ single source of truth for the initial catalogue.                │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Structure (from the business owner's product hierarchy):
 *
 *   PRODUCTS
 *   ├── RCC
 *   │   ├── RCC Chambers
 *   │   ├── RCC Manhole Covers
 *   │   ├── RCC Poles
 *   │   └── RCC Tree Guards
 *   ├── FRP Frame with Covers
 *   │   ├── Thermodrain
 *   │   └── Gully
 *   └── Pipes
 *       ├── HDPE
 *       ├── EcoDrain
 *       └── DWC
 *
 *   SERVICES
 *   └── Landscaping
 *
 * Do not add, merge or re-parent entries here without owner instruction.
 * Discovery groupings live in data/taxonomy.ts and must never be promoted
 * into this file as categories.
 *
 * Copy rules applied throughout: product descriptions explain what the
 * product is and where it is generally used. They contain no dimensions,
 * load classes, material grades, standards, certifications, prices, stock
 * or delivery guarantees, because none were supplied.
 */

export const divisions: ProductDivision[] = [
  { id: 'div-products', name: 'Products', slug: 'products' },
  { id: 'div-services', name: 'Services', slug: 'services' },
]

export const categories: ProductCategory[] = [
  {
    id: 'cat-rcc',
    divisionId: 'div-products',
    name: 'RCC',
    shortName: 'RCC',
    slug: 'rcc',
    summary:
      'Precast reinforced cement concrete products for drainage, utility and infrastructure works.',
    description:
      'Our RCC range covers precast reinforced cement concrete products used in drainage networks, utility routing and general civil works. These items are typically specified by contractors for chambers and access points, roadside and campus utility installations, and outdoor tree protection. Sizes and options are confirmed against your project requirement at the time of quotation.',
    image: null,
    visual: 'rcc-chamber',
  },
  {
    id: 'cat-frp',
    divisionId: 'div-products',
    name: 'FRP Frame with Covers',
    shortName: 'FRP',
    slug: 'frp-frame-with-covers',
    summary:
      'Fibre-reinforced polymer frame and cover assemblies for drainage and access applications.',
    description:
      'FRP frame and cover assemblies are composite alternatives to conventional metal and concrete covers. They are commonly used where lighter handling weight and corrosion resistance are preferred, such as drainage channels, gully points and access openings in developed areas. Available options are discussed against the access opening and site condition for your project.',
    image: null,
    visual: 'frp-frame-cover',
  },
  {
    id: 'cat-pipes',
    divisionId: 'div-products',
    name: 'Pipes',
    shortName: 'Pipes',
    slug: 'pipes',
    summary:
      'Piping and drainage conveyance products for infrastructure and construction requirements.',
    description:
      'Our piping range supports drainage conveyance, sub-surface drainage and utility routing requirements across construction and infrastructure projects. Pipe type and diameter are selected against the flow, depth and installation conditions of your site. Requirements can be quoted for individual lengths or project quantities.',
    image: null,
    visual: 'pipe-dwc',
  },
]

export const products: Product[] = [
  // ---------------------------------------------------------------- RCC
  {
    id: 'prd-rcc-chambers',
    categoryId: 'cat-rcc',
    name: 'RCC Chambers',
    slug: 'rcc-chambers',
    summary: 'Precast chambers for drainage, inspection and utility access points.',
    description:
      'RCC chambers are precast reinforced cement concrete units used to form inspection, junction and access points along drainage and utility lines. Because they arrive cast and cured, they reduce the amount of in-situ concrete work required at the chamber location and help keep excavation open for less time. Chambers are usually paired with a matching cover and frame at the surface.',
    image: null,
    gallery: [],
    visual: 'rcc-chamber',
    specifications: [],
    useCases: [
      'Inspection and junction chambers on storm water and sewerage lines',
      'Access points for underground utility and service routing',
      'Chamber requirements across roadway, campus and layout development works',
    ],
    applications: [
      'road-infrastructure',
      'drainage-systems',
      'commercial-construction',
      'industrial-projects',
    ],
    requirementTags: ['drainage', 'manhole-chambers', 'construction-products'],
    relatedProducts: ['prd-rcc-manhole-covers', 'prd-frp-gully', 'prd-pipe-dwc'],
    isActive: true,
  },
  {
    id: 'prd-rcc-manhole-covers',
    categoryId: 'cat-rcc',
    name: 'RCC Manhole Covers',
    slug: 'rcc-manhole-covers',
    summary: 'Precast concrete covers for manhole and chamber access openings.',
    description:
      'RCC manhole covers close off manhole and chamber openings at surface level while keeping the access point serviceable. They are a long-standing choice for drainage and utility networks where a concrete cover suits the surrounding surface and expected surface traffic. Covers are matched to the chamber opening on site, so share your opening size when requesting a quotation.',
    image: null,
    gallery: [],
    visual: 'rcc-manhole-cover',
    specifications: [],
    useCases: [
      'Surface closure for manholes and inspection chambers',
      'Access covers along drainage and sewerage networks',
      'Cover replacement during rehabilitation of existing chambers',
    ],
    applications: [
      'road-infrastructure',
      'drainage-systems',
      'residential-construction',
      'commercial-construction',
    ],
    requirementTags: ['drainage', 'manhole-chambers', 'construction-products'],
    relatedProducts: ['prd-rcc-chambers', 'prd-frp-gully', 'prd-frp-thermodrain'],
    isActive: true,
  },
  {
    id: 'prd-rcc-poles',
    categoryId: 'cat-rcc',
    name: 'RCC Poles',
    slug: 'rcc-poles',
    summary: 'Precast concrete poles for utility, boundary and site applications.',
    description:
      'RCC poles are precast reinforced concrete poles used for overhead utility routing, boundary and fencing lines, and general site installations. They are chosen where a durable, low-maintenance pole is preferred over alternatives. Pole length and section are selected against the intended use, so describe the application when sending your requirement.',
    image: null,
    gallery: [],
    visual: 'rcc-pole',
    specifications: [],
    useCases: [
      'Overhead utility and service line routing',
      'Boundary, fencing and compound wall lines',
      'Site and layout development installations',
    ],
    applications: ['road-infrastructure', 'industrial-projects', 'residential-construction'],
    requirementTags: ['utility-infrastructure', 'construction-products'],
    relatedProducts: ['prd-rcc-tree-guards', 'prd-rcc-chambers'],
    isActive: true,
  },
  {
    id: 'prd-rcc-tree-guards',
    categoryId: 'cat-rcc',
    name: 'RCC Tree Guards',
    slug: 'rcc-tree-guards',
    summary: 'Precast concrete guards that protect young trees and saplings.',
    description:
      'RCC tree guards are precast concrete surrounds placed around young trees and saplings to protect them from damage during their establishment period. They are commonly used in avenue plantation along roads, in parks and gardens, and across campus and township landscaping. Tree guards are frequently supplied alongside our landscaping work.',
    image: null,
    gallery: [],
    visual: 'rcc-tree-guard',
    specifications: [],
    useCases: [
      'Avenue and roadside plantation protection',
      'Parks, gardens and public landscape areas',
      'Campus, township and industrial premises plantation',
    ],
    applications: ['landscaping', 'road-infrastructure'],
    requirementTags: ['landscaping', 'construction-products'],
    relatedProducts: ['prd-rcc-poles', 'prd-rcc-chambers'],
    isActive: true,
  },

  // ---------------------------------------------- FRP Frame with Covers
  {
    id: 'prd-frp-thermodrain',
    categoryId: 'cat-frp',
    name: 'Thermodrain',
    slug: 'thermodrain',
    summary: 'Channel drain frame and cover assembly for surface water collection.',
    description:
      'Thermodrain is a frame and cover assembly used along linear surface drainage channels, where water is collected across a run rather than at a single point. It suits driveways, parking areas, walkways and paved surfaces that need continuous surface water collection. Channel length, opening width and cover options are worked out against your drainage layout.',
    image: null,
    gallery: [],
    visual: 'frp-thermodrain',
    specifications: [],
    useCases: [
      'Linear surface water drainage along paved areas',
      'Driveways, parking decks and internal roads',
      'Walkways and landscaped surfaces requiring channel drainage',
    ],
    applications: [
      'drainage-systems',
      'commercial-construction',
      'residential-construction',
      'landscaping',
    ],
    requirementTags: ['drainage', 'manhole-chambers'],
    relatedProducts: ['prd-frp-gully', 'prd-rcc-manhole-covers', 'prd-pipe-ecodrain'],
    isActive: true,
  },
  {
    id: 'prd-frp-gully',
    categoryId: 'cat-frp',
    name: 'Gully',
    seoName: 'Gully Frame with Covers',
    slug: 'gully',
    summary: 'Gully frame and cover assembly for point drainage inlets.',
    description:
      'Gully frame and cover assemblies form the inlet at point drainage locations, where surface water enters the underground drainage network. They are used along kerbs, road edges, parking areas and open yards. The assembly is selected against the gully opening and the surrounding surface, so share those details with your enquiry.',
    image: null,
    gallery: [],
    visual: 'frp-gully',
    specifications: [],
    useCases: [
      'Road edge and kerbside surface water inlets',
      'Parking areas, yards and open paved surfaces',
      'Point drainage inlets feeding underground drainage lines',
    ],
    applications: ['drainage-systems', 'road-infrastructure', 'commercial-construction'],
    requirementTags: ['drainage', 'manhole-chambers'],
    relatedProducts: ['prd-frp-thermodrain', 'prd-rcc-chambers', 'prd-pipe-dwc'],
    isActive: true,
  },

  // -------------------------------------------------------------- Pipes
  {
    id: 'prd-pipe-hdpe',
    categoryId: 'cat-pipes',
    name: 'HDPE',
    seoName: 'HDPE Pipes',
    slug: 'hdpe',
    summary: 'High-density polyethylene piping for conveyance and utility routing.',
    description:
      'HDPE pipe is a high-density polyethylene piping product used for fluid conveyance and for routing services and cables underground. Its flexibility and jointing options make it a practical choice on sites where pipe runs have to follow the ground profile. Diameter and pipe class are selected against your line pressure, depth and installation method.',
    image: null,
    gallery: [],
    visual: 'pipe-hdpe',
    specifications: [],
    useCases: [
      'Underground conveyance lines across project sites',
      'Cable and service ducting for utility infrastructure',
      'Industrial and campus piping requirements',
    ],
    applications: ['drainage-systems', 'industrial-projects', 'commercial-construction'],
    requirementTags: ['pipes', 'drainage', 'utility-infrastructure'],
    relatedProducts: ['prd-pipe-dwc', 'prd-pipe-ecodrain', 'prd-rcc-chambers'],
    isActive: true,
  },
  {
    id: 'prd-pipe-ecodrain',
    categoryId: 'cat-pipes',
    name: 'EcoDrain',
    seoName: 'EcoDrain Pipes',
    slug: 'ecodrain',
    summary: 'Drainage piping for surface and sub-surface water removal.',
    description:
      'EcoDrain is a drainage piping product supplied for surface and sub-surface water removal, including sites where water has to be collected from soil and planted areas and carried away to a drainage line. It is commonly specified on landscaped areas, plot development and building surrounds. Available options and lengths are confirmed against your requirement at the time of quotation.',
    image: null,
    gallery: [],
    visual: 'pipe-ecodrain',
    specifications: [],
    useCases: [
      'Sub-surface drainage for landscaped and planted areas',
      'Surface water removal around buildings and plots',
      'Drainage lines on residential and layout development sites',
    ],
    applications: ['drainage-systems', 'residential-construction', 'landscaping'],
    requirementTags: ['pipes', 'drainage'],
    relatedProducts: ['prd-pipe-dwc', 'prd-pipe-hdpe', 'prd-frp-thermodrain'],
    isActive: true,
  },
  {
    id: 'prd-pipe-dwc',
    categoryId: 'cat-pipes',
    name: 'DWC',
    seoName: 'DWC Pipes',
    slug: 'dwc',
    summary: 'Double wall corrugated piping for drainage and cable duct runs.',
    description:
      'DWC (double wall corrugated) pipe has a corrugated outer wall and a smooth inner wall. The profile gives the pipe stiffness while keeping the bore smooth for flow, which is why it is widely used for gravity drainage runs and for underground cable ducting. Diameter and run length are selected against your trench depth and layout.',
    image: null,
    gallery: [],
    visual: 'pipe-dwc',
    specifications: [],
    useCases: [
      'Gravity drainage and storm water lines',
      'Underground cable and telecom ducting',
      'Roadway and infrastructure crossings',
    ],
    applications: ['drainage-systems', 'road-infrastructure', 'industrial-projects'],
    requirementTags: ['pipes', 'drainage', 'utility-infrastructure'],
    relatedProducts: ['prd-pipe-hdpe', 'prd-pipe-ecodrain', 'prd-rcc-chambers'],
    isActive: true,
  },
]

export const services: Service[] = [
  {
    id: 'srv-landscaping',
    divisionId: 'div-services',
    name: 'Landscaping',
    slug: 'landscaping',
    summary:
      'Landscape development, plantation and outdoor area work for project and campus requirements.',
    description:
      'Alongside material supply, we take up landscaping work for project sites, campuses and developed premises. Scope is agreed against the site and the stage it is at, and can be combined with supply of related products such as RCC tree guards and drainage piping for planted areas. Share your site details and intended scope and we will discuss what is practical.',
    image: null,
    visual: 'landscaping',
    scope: [
      {
        title: 'Landscape development',
        detail:
          'Development of outdoor and green areas as part of project and premises works, worked out against the site layout.',
      },
      {
        title: 'Plantation',
        detail:
          'Plantation work for avenue, campus, garden and premises areas, discussed against the planting plan for the site.',
      },
      {
        title: 'Tree guards',
        detail:
          'Supply and placement of RCC tree guards to protect young trees and saplings while they establish.',
      },
      {
        title: 'Outdoor area development',
        detail:
          'Work on open and outdoor areas within the premises, coordinated with the other site activities under way.',
      },
      {
        title: 'Maintenance',
        detail:
          'Upkeep of developed landscape areas. Scope and duration are agreed separately for each site.',
      },
    ],
    applications: ['landscaping', 'commercial-construction', 'residential-construction'],
    requirementTags: ['landscaping'],
    isActive: true,
  },
]
