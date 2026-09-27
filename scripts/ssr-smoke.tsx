/**
 * Route smoke test.
 *
 * Renders every page through react-dom/server and asserts the content that
 * has to be on it. This exercises the real components, the data selectors
 * and the routing, so a broken route, a bad data lookup or a crashing
 * component fails here rather than in someone's browser.
 *
 * Pages are imported directly (rather than through App.tsx) because the
 * real route table code-splits them with React.lazy, which a synchronous
 * server render can only resolve to its Suspense fallback. The paths below
 * must therefore stay in step with src/App.tsx.
 *
 * Run with:  npm run smoke
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '../src/components/layout/Layout'
import About from '../src/pages/About'
import CategoryPage from '../src/pages/CategoryPage'
import Contact from '../src/pages/Contact'
import Home from '../src/pages/Home'
import NotFound from '../src/pages/NotFound'
import ProductPage from '../src/pages/ProductPage'
import Products from '../src/pages/Products'
import Projects from '../src/pages/Projects'
import RequestQuote from '../src/pages/RequestQuote'
import ServicePage from '../src/pages/ServicePage'
import Services from '../src/pages/Services'
import { categories, products, services } from '../src/data/catalogue'
import { VisitorProvider } from '../src/visitor/VisitorContext'

function renderRoute(location: string): string {
  return renderToStaticMarkup(
    // VisitorProvider mirrors src/App.tsx: the layout renders the welcome
    // modal, which reads visitor session state. Effects do not run during a
    // static render, so no request is made here.
    <VisitorProvider>
      <MemoryRouter initialEntries={[location]}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:categorySlug" element={<CategoryPage />} />
            <Route path="products/:categorySlug/:productSlug" element={<ProductPage />} />
            <Route path="services" element={<Services />} />
            <Route path="services/:serviceSlug" element={<ServicePage />} />
            <Route path="projects" element={<Projects />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="request-quote" element={<RequestQuote />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </VisitorProvider>,
  )
}

interface Check {
  path: string
  /** Strings that must appear in the rendered markup. */
  expect: string[]
  /** Strings that must NOT appear — guards against fabricated content. */
  reject?: string[]
}

const checks: Check[] = [
  {
    path: '/',
    expect: [
      'Reliable infrastructure products',
      'What are you looking for?',
      'RCC',
      'FRP Frame with Covers',
      'Pipes',
      'Landscaping',
      'Built around your project requirements',
      'Get a Quote',
    ],
  },
  {
    path: '/products',
    expect: [
      'Products for infrastructure &amp; construction',
      'Browse by product family',
      'Find products by requirement',
      'RCC Chambers',
      'RCC Manhole Covers',
      'RCC Poles',
      'RCC Tree Guards',
      'Thermodrain',
      'Gully',
      'HDPE',
      'EcoDrain',
      'DWC',
    ],
  },
  // Requirement filter is URL-driven: the example from the brief.
  {
    path: '/products?requirement=drainage',
    expect: [
      'results for',
      'Drainage',
      'RCC Chambers',
      'RCC Manhole Covers',
      'Thermodrain',
      'Gully',
      'HDPE',
      'EcoDrain',
      'DWC',
    ],
  },
  {
    path: '/products?application=landscaping',
    expect: ['results for', 'Landscaping', 'RCC Tree Guards'],
  },
  {
    path: '/products/rcc',
    expect: ['Products in RCC', 'RCC Chambers', 'RCC Tree Guards', 'Applications'],
  },
  {
    path: '/products/frp-frame-with-covers',
    expect: ['Products in FRP Frame with Covers', 'Thermodrain', 'Gully'],
  },
  {
    path: '/products/pipes',
    expect: ['Products in Pipes', 'HDPE', 'EcoDrain', 'DWC'],
  },
  {
    path: '/products/rcc/rcc-manhole-covers',
    expect: [
      'RCC Manhole Covers',
      'Specifications',
      'Specifications available on request',
      'Request a quotation',
      'Typical use cases',
      'Often requested together',
    ],
    // No specs were supplied for any product, so no numbers may appear.
    reject: ['mm dia', 'Load class', 'IS 458', 'Grade M'],
  },
  {
    path: '/products/pipes/hdpe',
    expect: ['HDPE Pipes', 'Specifications available on request', 'Request a quotation'],
  },
  {
    path: '/services',
    expect: ['Services alongside material supply', 'Landscaping'],
    // Unconfirmed offerings must not appear anywhere.
    reject: ['Paver Block Fixing', 'Tile Fixing', 'confirmation_required'],
  },
  {
    path: '/services/landscaping',
    expect: ['Landscaping for project', 'Scope of work', 'Plantation', 'Tree guards'],
  },
  {
    path: '/projects',
    expect: [
      'Products in real-world applications',
      'Project portfolio in preparation',
      'Where our products are used',
      'Road &amp; Infrastructure',
    ],
    /* Guards against fabricated portfolio content creeping back in.
       Phrases, not bare numbers — a bare "4.7" also matches SVG path data. */
    reject: [
      'aggregateRating',
      'ratingValue',
      'reviewCount',
      'Testimonial',
      'testimonials',
      'Projects completed',
      'years of experience',
      'Our clients',
      'Trusted by',
    ],
  },
  {
    path: '/about',
    expect: [
      'Veer Hanuman Trading Co.',
      '2016',
      'Proprietorship',
      'Hyderabad',
      'What we do',
      'Who we work with',
    ],
    // Third-party sourced details stay hidden until the owner confirms them.
    reject: ['R. Kumawat', '36CVMPK9596C1ZY', 'Crore', 'employees'],
  },
  {
    path: '/contact',
    expect: [
      'Talk to us about your requirement',
      'Bhanu Enclave',
      'Erragadda',
      '500018',
      'Business hours',
      '9:30 AM – 6:00 PM',
      'Send an enquiry',
    ],
    reject: ['36CVMPK9596C1ZY', 'Gundla Pochampally'],
  },
  {
    path: '/request-quote',
    expect: [
      'Send your project requirement',
      'Project requirement',
      'Company name',
      'Mobile',
      'WhatsApp number',
      'Size / specification',
      'Delivery location',
      'Expected requirement date',
      'Additional requirements',
      'Submit enquiry',
    ],
  },
  {
    path: '/request-quote?product=DWC%20Pipes',
    expect: ['Send your project requirement', 'Submit enquiry'],
  },
  {
    path: '/this-route-does-not-exist',
    expect: ['We could not find that page', 'Error 404'],
  },
]

/* Structural assertions on the catalogue itself. */
function checkHierarchy(): string[] {
  const failures: string[] = []

  const expected: Record<string, string[]> = {
    rcc: ['rcc-chambers', 'rcc-manhole-covers', 'rcc-poles', 'rcc-tree-guards'],
    'frp-frame-with-covers': ['thermodrain', 'gully'],
    pipes: ['hdpe', 'ecodrain', 'dwc'],
  }

  for (const [categorySlug, productSlugs] of Object.entries(expected)) {
    const category = categories.find((item) => item.slug === categorySlug)
    if (!category) {
      failures.push(`missing category: ${categorySlug}`)
      continue
    }
    const actual = products
      .filter((product) => product.categoryId === category.id)
      .map((product) => product.slug)
    if (actual.join(',') !== productSlugs.join(',')) {
      failures.push(
        `hierarchy drift in ${categorySlug}: expected [${productSlugs.join(', ')}], got [${actual.join(', ')}]`,
      )
    }
  }

  if (products.length !== 9) failures.push(`expected 9 products, found ${products.length}`)
  if (services.length !== 1) failures.push(`expected 1 service, found ${services.length}`)

  // Every product must carry at least one application and requirement tag,
  // otherwise it becomes undiscoverable in the finder.
  for (const product of products) {
    if (product.applications.length === 0) failures.push(`${product.slug}: no applications`)
    if (product.requirementTags.length === 0) failures.push(`${product.slug}: no requirementTags`)
    if (product.specifications.length > 0) {
      failures.push(`${product.slug}: specifications present — verify they were owner-supplied`)
    }
  }

  return failures
}

let failed = 0

const hierarchyFailures = checkHierarchy()
if (hierarchyFailures.length > 0) {
  failed += hierarchyFailures.length
  console.log('FAIL  catalogue hierarchy')
  for (const failure of hierarchyFailures) console.log(`        - ${failure}`)
} else {
  console.log('PASS  catalogue hierarchy (3 families / 9 products / 1 service, all tagged)')
}

for (const check of checks) {
  let markup = ''
  try {
    markup = renderRoute(check.path)
  } catch (error) {
    failed += 1
    console.log(`FAIL  ${check.path} — threw during render`)
    console.log(`        ${error instanceof Error ? error.message : String(error)}`)
    continue
  }

  const missing = check.expect.filter((needle) => !markup.includes(needle))
  const present = (check.reject ?? []).filter((needle) => markup.includes(needle))

  if (missing.length === 0 && present.length === 0) {
    console.log(`PASS  ${check.path}  (${markup.length.toLocaleString()} chars)`)
  } else {
    failed += 1
    console.log(`FAIL  ${check.path}`)
    for (const needle of missing) console.log(`        missing: ${needle}`)
    for (const needle of present) console.log(`        must not appear: ${needle}`)
  }
}

console.log('')
if (failed > 0) {
  console.log(`${failed} check(s) failed`)
  process.exit(1)
}
console.log(`All ${checks.length + 1} checks passed`)
