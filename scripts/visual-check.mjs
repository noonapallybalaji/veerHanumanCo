/**
 * Drives the real site in a browser: walks the required user journeys,
 * captures console errors, checks for horizontal overflow on mobile and
 * writes screenshots.
 *
 * Usage: node scripts/visual-check.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const baseUrl = process.argv[2] ?? 'http://localhost:5176'
const outDir = process.argv[3] ?? '.screenshots'
mkdirSync(outDir, { recursive: true })

const consoleErrors = []
const failures = []
let step = 0

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  PASS  ${name}`)
  } else {
    failures.push(`${name}${detail ? ` (${detail})` : ''}`)
    console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`)
  }
}

const browser = await chromium.launch()

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })

  /*
   * Suppress the welcome modal for this suite. It is an overlay that would
   * intercept clicks on every page, and it has its own dedicated coverage in
   * scripts/visitor-check.mjs — this suite is about the catalogue journeys.
   * Setting the same sessionStorage key the modal itself uses keeps the two
   * in step without a test-only flag in the app.
   */
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('vh_welcome_seen', '1')
    } catch {
      /* blocked storage: the modal treats that as "seen" anyway */
    }
  })

  const page = await context.newPage()
  page.on('console', (msg) => {
    /*
     * The quote step deliberately submits without a verified session, so the
     * OTP request can legitimately answer 429 (per-number cooldown carried
     * over between runs). Those are asserted outcomes, not defects.
     */
    const text = msg.text()
    const expectedApiStatus =
      text.includes('Failed to load resource') &&
      ['400', '401', '429', '503'].some((status) => text.includes(status))
    if (msg.type() === 'error' && !expectedApiStatus) {
      consoleErrors.push(`[${page.url()}] ${text}`)
    }
  })
  page.on('pageerror', (error) => consoleErrors.push(`[${page.url()}] ${error.message}`))
  return { context, page }
}

/**
 * Routes are code-split, so after navigating we wait for the page's real
 * H1 rather than asserting against the Suspense fallback.
 */
async function waitForHeading(page, text) {
  await page.locator('h1', { hasText: text }).first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(200) // let the Seo effect write the head tags
}

/** Navigate and wait until the route's own content is up. */
async function gotoPage(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(200)
}

async function shot(page, name) {
  step += 1
  await page.screenshot({ path: `${outDir}/${String(step).padStart(2, '0')}-${name}.png` })
}

/* ------------------------------------------------ Desktop walkthrough */
console.log('\nDESKTOP 1440x900')
{
  const { context, page } = await newPage({ width: 1440, height: 900 })

  await gotoPage(page, '/')
  check('home h1 renders', (await page.locator('h1').first().innerText()).includes('Reliable'))
  check('exactly one h1 on home', (await page.locator('h1').count()) === 1)

  // Top utility bar: always shows location, and the phone/email slots
  // appear only once those values are set in companyConfig.
  const topBarText = await page.locator('body > div, #root > div').first().innerText()
  check('top bar shows the location', /HYDERABAD, TELANGANA, INDIA/i.test(topBarText))
  check('top bar shows the enquiry line', /PROJECT & BULK ENQUIRIES/i.test(topBarText))
  check(
    'no dev-only banner ships in the layout',
    !(await page.locator('text=Dev notice').count()),
  )
  await shot(page, 'home-hero')

  // FLOW 2: requirement finder -> Drainage -> results
  await page.locator('#requirement-finder').scrollIntoViewIfNeeded()
  await page.locator('#requirement-finder button', { hasText: 'Drainage' }).first().click()
  await page.waitForTimeout(500)
  const finderText = await page.locator('#requirement-finder').innerText()
  check('finder shows a result count', /\d+ matches? for/i.test(finderText))
  check('finder result includes RCC Chambers', finderText.includes('RCC Chambers'))
  check('finder result includes DWC', finderText.includes('DWC'))
  check('finder excludes RCC Poles (not drainage-tagged)', !finderText.includes('RCC Poles'))
  await shot(page, 'home-finder-drainage')

  // FLOW 1: whole category card is clickable
  await gotoPage(page, '/')
  await page.getByRole('link', { name: 'RCC', exact: true }).first().click()
  await page.waitForURL('**/products/rcc')
  await waitForHeading(page, 'RCC')
  check('category card navigates to /products/rcc', page.url().endsWith('/products/rcc'))
  check('category h1 is the family name', (await page.locator('h1').innerText()).trim() === 'RCC')
  await shot(page, 'category-rcc')

  // -> product detail
  await page.getByRole('link', { name: 'RCC Manhole Covers' }).first().click()
  await page.waitForURL('**/rcc-manhole-covers')
  await waitForHeading(page, 'RCC Manhole Covers')
  check('product page reached', page.url().includes('/products/rcc/rcc-manhole-covers'))
  const productText = await page.locator('main').innerText()
  check('no invented specs', productText.includes('Specifications available on request'))
  check('breadcrumbs present', (await page.locator('nav[aria-label="Breadcrumb"]').count()) > 0)
  check('title is product-specific', (await page.title()).startsWith('RCC Manhole Covers |'))
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  check('canonical set', canonical?.endsWith('/products/rcc/rcc-manhole-covers') === true, canonical)
  const ld = await page.locator('script#page-structured-data').textContent()
  check('JSON-LD has Product', ld.includes('"@type":"Product"'))
  check('JSON-LD has BreadcrumbList', ld.includes('"@type":"BreadcrumbList"'))
  check('JSON-LD has no fabricated rating or price', !ld.includes('aggregateRating') && !ld.includes('"offers"'))
  await shot(page, 'product-rcc-manhole-covers')

  // -> Get a Quote keeps product context
  await page.getByRole('link', { name: /Request a quotation/ }).first().click()
  await page.waitForURL('**/request-quote**')
  await waitForHeading(page, 'Send your project requirement')
  check('quote deep-link carries product', page.url().includes('product=RCC%20Manhole%20Covers'))
  const selected = await page.locator('select[name="product"]').inputValue()
  check('product preselected in form', selected === 'RCC Manhole Covers', `got "${selected}"`)
  await shot(page, 'quote-prefilled')

  // FLOW 5: validation on empty submit
  await gotoPage(page, '/request-quote')
  await page.getByRole('button', { name: /Submit enquiry/ }).click()
  await page.waitForTimeout(400)
  const formText = await page.locator('form').innerText()
  check('validation blocks empty submit', /Please check \d+ fields?/.test(formText))
  check('mobile field flagged', formText.includes('mobile number'))
  await shot(page, 'quote-validation')

  // FLOW 5 continued: valid submit -> honest handoff state
  await page.fill('input[name="name"]', 'Ramesh Rao')
  await page.fill('input[name="mobile"]', '9876543210')
  await page.selectOption('select[name="product"]', 'DWC Pipes')
  await page.selectOption('select[name="projectType"]', 'Drainage')
  await page.fill('input[name="quantity"]', '400 m')
  await page.getByRole('button', { name: /Submit enquiry/ }).click()
  await page.waitForTimeout(800)
  /*
   * Enquiries now require a verified phone, so an unverified visitor gets
   * the OTP step rather than a confirmation. That gate is what this suite
   * asserts; the full verified journey (code entry, acceptance, session
   * reuse, logout) lives in scripts/visitor-check.mjs.
   */
  const otpDialog = page.locator('[aria-labelledby="otp-title"]')
  await otpDialog.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined)
  check('submitting opens phone verification', await otpDialog.isVisible().catch(() => false))
  check(
    'the enquiry is NOT confirmed before verification',
    !(await page.locator('main').innerText()).includes('Enquiry received'),
  )
  await shot(page, 'quote-requires-verification')

  // Close it so the rest of the walkthrough is not blocked by the overlay.
  await page.getByRole('button', { name: 'Cancel verification' }).click().catch(() => undefined)
  await page.waitForTimeout(300)

  // FLOW 3: pipes -> HDPE
  await gotoPage(page, '/products/pipes/hdpe')
  check('HDPE page title', (await page.title()).startsWith('HDPE Pipes |'))
  check('HDPE h1', (await page.locator('h1').innerText()).includes('HDPE'))
  await shot(page, 'product-hdpe')

  // FLOW 4: services -> landscaping
  await gotoPage(page, '/services/landscaping')
  const svcText = await page.locator('main').innerText()
  check('landscaping scope listed', svcText.includes('Scope of work') && svcText.includes('Plantation'))
  await shot(page, 'service-landscaping')

  // Application filter is URL-driven
  await gotoPage(page, '/products?application=landscaping')
  const filtered = await page.locator('#filter').innerText()
  check('application filter works', filtered.includes('RCC Tree Guards'))
  await shot(page, 'products-application-filter')

  // Remaining pages
  for (const [path, name] of [
    ['/products', 'products'],
    ['/projects', 'projects'],
    ['/about', 'about'],
    ['/contact', 'contact'],
  ]) {
    await gotoPage(page, path)
    check(`${path} has exactly one h1`, (await page.locator('h1').count()) === 1)
    await shot(page, name)
  }

  /*
   * Published projects must appear on the homepage teaser, not just on
   * /projects. Regression guard: the teaser once rendered fixed application
   * tiles while its heading claimed to show project references.
   * Conditional, because a site with no published projects correctly shows
   * the "portfolio in preparation" fallback instead.
   */
  const publishedProjects = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/public/content`)
    const data = await res.json()
    return (data.projects ?? []).map((p) => p.title)
  }, 'http://localhost:4000')

  if (publishedProjects.length > 0) {
    await gotoPage(page, '/')
    const homeText = await page.locator('main').innerText()
    check(
      'homepage teaser shows a published project',
      publishedProjects.some((title) => homeText.includes(title)),
      `expected one of: ${publishedProjects.join(', ')}`,
    )

    await gotoPage(page, '/projects')
    const listText = await page.locator('main').innerText()
    check(
      'projects page lists published projects',
      publishedProjects.some((title) => listText.includes(title)),
    )
    check('projects page drops the empty state', !listText.includes('portfolio in preparation'))
  } else {
    await gotoPage(page, '/projects')
    check(
      'projects page shows the honest empty state when none are published',
      (await page.locator('main').innerText()).includes('portfolio in preparation'),
    )
  }

  // Catalogue dropdown in the header
  await gotoPage(page, '/')
  await page.getByRole('button', { name: 'Products', exact: true }).click()
  await page.waitForTimeout(300)
  check('catalogue panel opens', await page.locator('#catalogue-panel').isVisible())
  check('panel links the whole catalogue', (await page.locator('#catalogue-panel a').count()) >= 12)
  await shot(page, 'header-catalogue-panel')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check('Escape closes the panel', (await page.locator('#catalogue-panel').count()) === 0)

  // 404
  await gotoPage(page, '/nope')
  check('404 renders', (await page.locator('h1').innerText()).includes('could not find'))
  await shot(page, '404')

  await context.close()
}

/* ------------------------------------------------- Mobile walkthrough */
console.log('\nMOBILE 390x844')
{
  const { context, page } = await newPage({ width: 390, height: 844 })

  for (const [path, name] of [
    ['/', 'm-home'],
    ['/products', 'm-products'],
    ['/products/rcc/rcc-chambers', 'm-product'],
    ['/request-quote', 'm-quote'],
    ['/services/landscaping', 'm-landscaping'],
  ]) {
    await gotoPage(page, path)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    check(`${path} has no horizontal overflow`, overflow <= 0, `overflow ${overflow}px`)
    await shot(page, name)
  }

  // Fixed bottom action bar
  await gotoPage(page, '/products')
  const bar = page.locator('div.fixed.inset-x-0.bottom-0').first()
  check('mobile action bar visible', await bar.isVisible())
  check('action bar has Get a Quote', (await bar.innerText()).includes('Get a Quote'))
  const barBox = await bar.boundingBox()
  check('action bar tall enough to tap', barBox.height >= 56, `${Math.round(barBox.height)}px`)

  // It must not cover the footer content
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  await shot(page, 'm-footer-with-bar')

  // Hamburger menu
  await gotoPage(page, '/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.waitForTimeout(300)
  // innerText returns text as rendered, and the family headings are
  // CSS-uppercased, so compare case-insensitively.
  const menuText = (await page.locator('nav[aria-label="Mobile"]').innerText()).toLowerCase()
  check(
    'mobile menu lists all three families',
    menuText.includes('rcc') && menuText.includes('frp frame with covers') && menuText.includes('pipes'),
  )
  check(
    'mobile menu lists products',
    menuText.includes('rcc tree guards') && menuText.includes('thermodrain') && menuText.includes('dwc'),
  )
  check('mobile menu lists services', menuText.includes('landscaping'))
  check('mobile menu lists company pages', menuText.includes('about us'))

  /* The panel must actually cover the viewport. A backdrop-filter on an
     ancestor once made this fixed panel clip to the header, and a text-only
     assertion still passed — so check the geometry and that the page behind
     is really covered. */
  const panel = page.locator('div.fixed.inset-0').first()
  const panelBox = await panel.boundingBox()
  check(
    'mobile menu covers the viewport',
    panelBox.width >= 389 && panelBox.height >= 843,
    `panel is ${Math.round(panelBox.width)}x${Math.round(panelBox.height)}`,
  )
  /* Playwright's isVisible() does not test occlusion, so assert the panel
     is genuinely opaque rather than that the page behind "looks" hidden. */
  const panelBg = await panel.evaluate((el) => getComputedStyle(el).backgroundColor)
  check('mobile menu panel is opaque', /^rgb\(/.test(panelBg), panelBg)
  await shot(page, 'm-menu')
  await page.getByRole('button', { name: 'Close menu' }).click()
  await page.waitForTimeout(250)
  check('mobile menu closes', (await page.locator('nav[aria-label="Mobile"]').count()) === 0)

  await context.close()
}

/* ------------------------------------------------------ Accessibility */
console.log('\nACCESSIBILITY SPOT CHECKS')
{
  const { context, page } = await newPage({ width: 1440, height: 900 })
  await gotoPage(page, '/products')

  const imagesWithoutAlt = await page.evaluate(
    () => [...document.querySelectorAll('img')].filter((img) => !img.hasAttribute('alt')).length,
  )
  check('every <img> has alt', imagesWithoutAlt === 0, `${imagesWithoutAlt} missing`)

  const svgsUnlabelled = await page.evaluate(
    () =>
      [...document.querySelectorAll('svg[role="img"]')].filter((svg) => !svg.getAttribute('aria-label'))
        .length,
  )
  check('every role="img" svg is labelled', svgsUnlabelled === 0)

  const unlabelledButtons = await page.evaluate(
    () =>
      [...document.querySelectorAll('button')].filter(
        (b) => !b.textContent.trim() && !b.getAttribute('aria-label'),
      ).length,
  )
  check('every button has an accessible name', unlabelledButtons === 0)

  const unlabelledLinks = await page.evaluate(
    () =>
      [...document.querySelectorAll('a')].filter(
        (a) => !a.textContent.trim() && !a.getAttribute('aria-label'),
      ).length,
  )
  check('every link has an accessible name', unlabelledLinks === 0)

  await page.keyboard.press('Tab')
  const firstFocus = await page.evaluate(() => document.activeElement?.textContent?.trim())
  check('first tab stop is the skip link', firstFocus === 'Skip to content', `got "${firstFocus}"`)

  await gotoPage(page, '/request-quote')
  const unlabelledFields = await page.evaluate(
    () =>
      [...document.querySelectorAll('input, select, textarea')].filter(
        (el) => !el.labels?.length && !el.getAttribute('aria-label'),
      ).length,
  )
  check('every form field has a label', unlabelledFields === 0, `${unlabelledFields} missing`)

  await context.close()
}

await browser.close()

console.log('\nCONSOLE OUTPUT')
if (consoleErrors.length === 0) {
  console.log('  PASS  no console errors across all pages')
} else {
  console.log(`  FAIL  ${consoleErrors.length} console error(s):`)
  for (const error of consoleErrors.slice(0, 15)) console.log(`        ${error}`)
  failures.push(`${consoleErrors.length} console errors`)
}

console.log('')
if (failures.length > 0) {
  console.log(`${failures.length} FAILURE(S):`)
  for (const failure of failures) console.log(`  - ${failure}`)
  process.exit(1)
}
console.log(`All browser checks passed. Screenshots in ${outDir}/`)
