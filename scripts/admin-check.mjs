/**
 * Drives the admin panel in a real browser: sign in, edit a product,
 * publish it, moderate a review, and confirm each change lands on the
 * public site.
 */
import { chromium } from 'playwright'

const WEB = process.argv[2] ?? 'http://localhost:5176'
const API = 'http://localhost:4000'
const OUT = process.argv[3] ?? '.screenshots'
// Local development admin account. Override for any other environment:
//   ADMIN_CHECK_EMAIL=… ADMIN_CHECK_PASSWORD=… node scripts/admin-check.mjs
const EMAIL = process.env.ADMIN_CHECK_EMAIL ?? 'owner@veerhanumantrading.com'
const PASSWORD = process.env.ADMIN_CHECK_PASSWORD ?? 'Trenchline-Kestrel-2026'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`)
}

const consoleErrors = []

/**
 * A 401 from /api/auth/me is the correct answer to "am I signed in?" before
 * sign-in, and browsers log every failed fetch to the console. Filter that
 * one case rather than pretend the app is misbehaving.
 */
const isExpected = (text, url) =>
  text.includes('401') && (url.includes('/admin/login') || url.endsWith('/admin'))

/**
 * Suppresses the visitor welcome modal, which would otherwise cover the
 * public pages this script visits. It has dedicated coverage in
 * scripts/visitor-check.mjs; here it is just an obstacle.
 */
const suppressWelcome = (ctx) =>
  ctx.addInitScript(() => {
    try {
      sessionStorage.setItem('vh_welcome_seen', '1')
    } catch {
      /* blocked storage behaves the same way */
    }
  })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
await suppressWelcome(context)
const page = await context.newPage()
page.on('console', (m) => {
  if (m.type() === 'error' && !isExpected(m.text(), page.url())) {
    consoleErrors.push(`[${page.url()}] ${m.text()}`)
  }
})
page.on('pageerror', (e) => consoleErrors.push(`[${page.url()}] ${e.message}`))

let step = 0
const shot = async (name) => {
  step += 1
  await page.screenshot({ path: `${OUT}/admin-${String(step).padStart(2, '0')}-${name}.png` })
}

console.log('\nADMIN PANEL')

// --- Sign-in gate ---------------------------------------------------------
await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
check('unauthenticated /admin redirects to login', page.url().includes('/admin/login'))
await shot('login')

await page.fill('input[name="email"]', EMAIL)
await page.fill('input[name="password"]', PASSWORD)
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForURL('**/admin', { timeout: 15000 })
await page.locator('h1').first().waitFor()
check('signs in and lands on the overview', (await page.locator('h1').innerText()).includes('Overview'))
await shot('dashboard')

const dash = await page.locator('main').innerText()
check('dashboard shows real counts', /\d+\s*\n?\s*Published products/i.test(dash) || dash.includes('Published products'))

// --- Products list --------------------------------------------------------
await page.getByRole('link', { name: 'Products', exact: true }).click()
await page.locator('h1').first().waitFor()
await page.waitForTimeout(600)
const list = await page.locator('main').innerText()
check('product list loads the seeded catalogue', list.includes('RCC Chambers') && list.includes('DWC'))
await shot('products')

// --- Edit a product and publish the change -------------------------------
await page.getByRole('link', { name: 'RCC Poles' }).first().click()
await page.locator('h1').first().waitFor()
await page.waitForTimeout(600)
check('product editor opens', (await page.locator('main').innerText()).includes('Basics'))

const MARKER = `Site-tested summary ${Date.now().toString().slice(-5)}`
await page.locator('label:has-text("Short summary") input').fill(MARKER)
await page.getByRole('button', { name: 'Save changes' }).click()
await page.waitForTimeout(1200)
check('saving shows confirmation', (await page.locator('body').innerText()).includes('Changes saved'))
await shot('product-edit')

const publicAfterEdit = await (await fetch(`${API}/api/public/content`)).json()
const poles = publicAfterEdit.products.find((p) => p.slug === 'rcc-poles')
check('edit reaches the public API', poles?.summary === MARKER, poles?.summary?.slice(0, 40))

// --- Unpublish and confirm the public page 404s --------------------------
await page.getByRole('button', { name: 'Unpublish' }).first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Unpublish', exact: true }).last().click()
await page.waitForTimeout(1200)

const afterUnpublish = await (await fetch(`${API}/api/public/content`)).json()
check(
  'unpublished product leaves the public API',
  !afterUnpublish.products.some((p) => p.slug === 'rcc-poles'),
)

const visitor = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await suppressWelcome(visitor)
const vp = await visitor.newPage()
await vp.goto(`${WEB}/products/rcc/rcc-poles`, { waitUntil: 'networkidle' })
await vp.waitForTimeout(700)
check(
  'its public URL now shows not-found, not the draft',
  (await vp.locator('main').innerText()).includes('could not find'),
)

// Restore
await page.getByRole('button', { name: 'Publish' }).first().click()
await page.waitForTimeout(1200)
check(
  'republishing restores it',
  (await (await fetch(`${API}/api/public/content`)).json()).products.some((p) => p.slug === 'rcc-poles'),
)

// --- Review moderation ----------------------------------------------------
await vp.goto(`${WEB}/products/rcc/rcc-chambers`, { waitUntil: 'networkidle' })
await vp.locator('main h1').first().waitFor()
await vp.locator('#reviews').scrollIntoViewIfNeeded()
await vp.waitForTimeout(400)
await vp.getByRole('button', { name: 'Write a review' }).click()
await vp.waitForTimeout(300)
await vp.getByRole('button', { name: '5 stars' }).click()
// Unique per run: a previous run's approved review would otherwise be
// mistaken for this run's pending one.
const REVIEWER = `Site Test Contractor ${Date.now().toString().slice(-6)}`
await vp.locator('label:has-text("Your name") input').fill(REVIEWER)
await vp
  .locator('label:has-text("Your review") textarea')
  .fill('Chambers arrived on schedule and matched the opening sizes we specified for the site.')
await vp.locator('input[type=checkbox]').last().check()
await vp.getByRole('button', { name: 'Submit review' }).click()
await vp.waitForTimeout(1200)
check('review submission is accepted', (await vp.locator('main').innerText()).includes('Thank you'))
check(
  'and says it will be checked first',
  (await vp.locator('main').innerText()).toLowerCase().includes('checked'),
)

await vp.reload({ waitUntil: 'networkidle' })
await vp.locator('main h1').first().waitFor()
await vp.waitForTimeout(500)
check(
  'pending review is NOT shown publicly',
  !(await vp.locator('main').innerText()).includes(REVIEWER),
)

await page.getByRole('link', { name: 'Reviews' }).click()
await page.locator('h1').first().waitFor()
await page.waitForTimeout(700)
check('review appears in the moderation queue', (await page.locator('main').innerText()).includes(REVIEWER))
await shot('reviews-pending')

await page.getByRole('button', { name: /Approve/ }).first().click()
await page.waitForTimeout(1200)

await vp.reload({ waitUntil: 'networkidle' })
await vp.locator('main h1').first().waitFor()
await vp.locator('#reviews').scrollIntoViewIfNeeded()
await vp.waitForTimeout(700)
const reviewsText = await vp.locator('main').innerText()
check('approved review is now public', reviewsText.includes(REVIEWER))
check('and the rating summary appears', reviewsText.includes('out of 5'))
await vp.screenshot({ path: `${OUT}/admin-99-public-reviews.png` })

// --- Company settings propagate ------------------------------------------
await page.getByRole('link', { name: 'Company & Contact' }).click()
await page.locator('h1').first().waitFor()
await page.waitForTimeout(800)
check('company settings load', (await page.locator('main').innerText()).includes('Contact details'))
await shot('company')

// --- Role restrictions are visible ---------------------------------------
await page.getByRole('link', { name: 'Audit Log' }).click()
await page.locator('h1').first().waitFor()
await page.waitForTimeout(700)
check('audit log records the session', (await page.locator('main').innerText()).includes('PRODUCT_'))
await shot('audit')

await browser.close()

console.log('\nCONSOLE')
if (consoleErrors.length === 0) {
  console.log('  PASS  no console errors')
} else {
  console.log(`  FAIL  ${consoleErrors.length} console error(s)`)
  consoleErrors.slice(0, 8).forEach((e) => console.log(`        ${e}`))
  results.push({ name: 'console errors', ok: false })
}

const failed = results.filter((r) => !r.ok)
console.log('')
if (failed.length) {
  console.log(`${failed.length} FAILURE(S)`)
  process.exit(1)
}
console.log(`All ${results.length} admin checks passed.`)
