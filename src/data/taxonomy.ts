import type { Application, RequirementTag } from './types'

/**
 * Applications describe WHERE a product is used.
 * They are a discovery dimension, NOT catalogue categories.
 */
export const applications: Application[] = [
  {
    id: 'app-road',
    name: 'Road & Infrastructure',
    slug: 'road-infrastructure',
    description:
      'Roadway, utility corridor and public infrastructure works requiring precast and piping materials.',
    icon: 'road',
  },
  {
    id: 'app-drainage',
    name: 'Drainage Systems',
    slug: 'drainage-systems',
    description:
      'Storm water, surface water and sewerage networks, including chambers, covers and drainage piping.',
    icon: 'drainage',
  },
  {
    id: 'app-residential',
    name: 'Residential Construction',
    slug: 'residential-construction',
    description:
      'Housing, apartment and layout development requirements across plumbing, drainage and site works.',
    icon: 'residential',
  },
  {
    id: 'app-commercial',
    name: 'Commercial Construction',
    slug: 'commercial-construction',
    description:
      'Commercial buildings, campuses and retail developments needing drainage and utility products.',
    icon: 'commercial',
  },
  {
    id: 'app-industrial',
    name: 'Industrial Projects',
    slug: 'industrial-projects',
    description:
      'Plant, factory and industrial park requirements where bulk quantities and site coordination matter.',
    icon: 'industrial',
  },
  {
    id: 'app-landscaping',
    name: 'Landscaping',
    slug: 'landscaping',
    description:
      'Landscape development, plantation and outdoor area works, including tree protection.',
    icon: 'landscape',
  },
]

/**
 * Requirement tags are the entry point for buyers who know the
 * application but not the product name. Also a discovery dimension.
 */
export const requirementTags: RequirementTag[] = [
  {
    id: 'req-drainage',
    name: 'Drainage',
    slug: 'drainage',
    hint: 'Storm water, surface and sewerage drainage',
    icon: 'drainage',
  },
  {
    id: 'req-manhole',
    name: 'Manhole & Chambers',
    slug: 'manhole-chambers',
    hint: 'Inspection chambers, covers and frames',
    icon: 'manhole',
  },
  {
    id: 'req-utility',
    name: 'Utility Infrastructure',
    slug: 'utility-infrastructure',
    hint: 'Cable, service and utility routing',
    icon: 'utility',
  },
  {
    id: 'req-pipes',
    name: 'Pipes',
    slug: 'pipes',
    hint: 'HDPE, DWC and drainage piping',
    icon: 'pipes',
  },
  {
    id: 'req-landscaping',
    name: 'Landscaping',
    slug: 'landscaping',
    hint: 'Plantation, tree protection and outdoor works',
    icon: 'landscape',
  },
  {
    id: 'req-construction',
    name: 'Construction Products',
    slug: 'construction-products',
    hint: 'Precast and site materials for civil works',
    icon: 'construction',
  },
]

export const applicationBySlug = new Map(applications.map((a) => [a.slug, a]))
export const requirementTagBySlug = new Map(requirementTags.map((t) => [t.slug, t]))

/** Project types offered in the quote form, aligned to the application list. */
export const projectTypes = [
  'Road & Infrastructure',
  'Drainage',
  'Residential',
  'Commercial',
  'Industrial',
  'Landscaping',
  'Other',
] as const

export type ProjectType = (typeof projectTypes)[number]
