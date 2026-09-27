/**
 * Drives the welcome modal and the OTP-gated enquiry flow in a real browser.
 *
 * Requires the API running with SMS_PROVIDER=console and access to the
 * database, from which the code is read (the same brute-force-the-hash
 * approach the API tests use, so no test hook exists in production code).
 *
 * Usage: node scripts/visitor-check.mjs [webUrl] [outDir]
 */
import { chromium } from 'playwright'
import { createHmac } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import 'dotenv/config'

const WEB = process.argv[2] ?? 'http://localhost:5176'
const OUT = process.argv[3] ?? '.screenshots'
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`)
}

/*
 * Reads the newest live challenge hash directly from Postgres, then
 * brute-forces the 6-digit space to recover the code. Done this way rather
 * than adding a "reveal the OTP" hook to the server, so production code
 * carries no test affordance — and it doubles as proof the code is stored
 * only as a hash.
 */
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function recoverCode(e164) {
  const { rows } = await db.query(
    'SELECT "codeHash" FROM "OtpChallenge" WHERE phone = $1 AND "consumedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1',
    [e164],
  )
  const hash = rows[0]?.codeHash
  if (!hash) throw new Error(`no live challenge for ${e164}`)

  const secret = process.env.AUTH_SECRET
  for (let n = 0; n < 1_000_000; n += 1) {
    const candidate = String(n).padStart(6, '0')
    if (createHmac('sha256', secret).update(`${e164}:${candidate}`).digest('hex') === hash) {
      return candidate
    }
  }
  throw new Error('could not recover code')
}

const consoleErrors = []
const browser = await chromium.launch()

async function freshPage(viewport = { width: 1440, height: 950 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  /*
   * This script deliberately exercises failure paths — a wrong code (400)
   * and the resend cooldown (429) — and the browser logs every non-2xx
   * fetch as a console error. Those are asserted outcomes, not defects, so
   * only unexpected statuses count. 401 is the normal "not signed in" probe.
   */
  const expectedStatuses = ['400', '401', '429']
  page.on('console', (m) => {
    const text = m.text()
    const isExpectedApiStatus =
      text.includes('Failed to load resource') && expectedStatuses.some((s) => text.includes(s))
    if (m.type() === 'error' && !isExpectedApiStatus) consoleErrors.push(text)
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  return { context, page }
}

let step = 0
const shot = async (page, name) => {
  step += 1
  await page.screenshot({ path: `${OUT}/visitor-${String(step).padStart(2, '0')}-${name}.png` })
}

console.log('\nWELCOME MODAL')
{
  const { context, page } = await freshPage()
  await page.goto(`${WEB}/`, { waitUntil: 'networkidle' })
  await page.locator('main h1').first().waitFor()

  const modal = page.getByRole('dialog', { name: /Tell us what you need/i })
  await modal.waitFor({ state: 'visible', timeout: 8000 })
  check('welcome modal appears for a new session', await modal.isVisible())
  await shot(page, 'welcome-modal')

  check(
    'collects the required and optional fields',
    (await modal.innerText()).includes('Your name') &&
      (await modal.innerText()).includes('Mobile number') &&
      (await modal.innerText()).includes('Company') &&
      (await modal.innerText()).includes('Email'),
  )
  check(
    'marketing consent is separate and optional',
    (await modal.innerText()).includes('Optional: also send me occasional updates'),
  )

  // Dismiss and confirm browsing continues.
  await page.getByRole('button', { name: /Maybe later/i }).click()
  await page.waitForTimeout(400)
  check('can be dismissed', !(await modal.isVisible().catch(() => false)))
  check('site remains usable after dismissal', await page.locator('main h1').first().isVisible())

  // Same session -> must not reappear.
  await page.goto(`${WEB}/products`, { waitUntil: 'networkidle' })
  await page.locator('main h1').first().waitFor()
  await page.waitForTimeout(2000)
  check(
    'does not reappear during the same browser session',
    (await page.getByRole('dialog', { name: /Tell us what you need/i }).count()) === 0,
  )
  await context.close()
}

console.log('\nWELCOME MODAL — UNVERIFIED LEAD')
{
  const { context, page } = await freshPage()
  await page.goto(`${WEB}/`, { waitUntil: 'networkidle' })
  // Located by the stable labelledby id: the dialog's accessible NAME
  // changes when it swaps to the success state.
  const modal = page.locator('[aria-labelledby="welcome-title"]')
  await modal.waitFor({ state: 'visible', timeout: 8000 })

  await modal.locator('label:has-text("Your name") input').fill('Unverified Walk-in')
  await modal.locator('label:has-text("Mobile number") input').fill('9876511001')
  await modal.locator('label:has-text("What do you need?") textarea').fill('Pricing for DWC pipes')
  await modal.locator('input[type=checkbox]').first().check()
  await modal.getByRole('button', { name: /Send without verifying/i }).click()
  await page.waitForTimeout(1500)

  check('unverified lead is accepted', (await modal.innerText()).includes('Thank you'))
  check(
    'and the copy does not imply verification',
    (await modal.innerText()).includes('verify your number later'),
  )
  await shot(page, 'lead-unverified')
  await context.close()
}

console.log('\nENQUIRY REQUIRES OTP')
{
  const { context, page } = await freshPage()
  const PHONE = '9876511002'
  const E164 = `+91${PHONE}`

  await page.goto(`${WEB}/request-quote`, { waitUntil: 'networkidle' })
  await page.locator('main h1').first().waitFor()
  /*
   * Dismiss the welcome modal before touching the form. It appears on a
   * timer, so wait for it rather than racing it — an undismissed overlay
   * silently swallows the submit click.
   */
  const welcome = page.locator('[aria-labelledby="welcome-title"]')
  await welcome.waitFor({ state: 'visible', timeout: 8000 }).catch(() => undefined)
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Maybe later/i }).click()
    await welcome.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined)
  }

  check(
    'form warns that the number will be verified',
    (await page.locator('form').innerText()).includes('text a short code'),
  )

  await page.fill('input[name="name"]', 'Verified Contractor')
  await page.fill('input[name="mobile"]', PHONE)
  await page.selectOption('select[name="product"]', { index: 1 })
  await page.selectOption('select[name="projectType"]', 'Drainage')
  await page.fill('input[name="quantity"]', '300 m')
  await page.getByRole('button', { name: /Submit enquiry/i }).click()

  // Stable locator: the dialog's accessible name is content-dependent.
  const otp = page.locator('[aria-labelledby="otp-title"]')
  await otp.waitFor({ state: 'visible', timeout: 10000 })
  check('OTP dialog opens instead of submitting', await otp.isVisible())
  await shot(page, 'otp-dialog')

  // Wrong code first.
  const real = await recoverCode(E164)
  const wrong = real === '000000' ? '111111' : '000000'
  await otp.locator('#otp-code').fill(wrong)
  await otp.getByRole('button', { name: /Verify & continue/i }).click()
  await page.waitForTimeout(1500)
  await shot(page, 'otp-wrong-code')
  const afterWrong = (await otp.count()) ? await otp.innerText() : '(dialog closed)'
  check('wrong code is rejected with a message', afterWrong.includes('not correct'), afterWrong.slice(0, 80).replace(/\s+/g, ' '))

  // Form data must have survived.
  await otp.getByRole('button', { name: /^Cancel$/ }).click()
  await page.waitForTimeout(400)
  check(
    'form data survives cancelling verification',
    (await page.locator('input[name="name"]').inputValue()) === 'Verified Contractor' &&
      (await page.locator('input[name="quantity"]').inputValue()) === '300 m',
  )

  // Now do it properly.
  await page.getByRole('button', { name: /Submit enquiry/i }).click()
  await otp.waitFor({ state: 'visible', timeout: 10000 })
  await otp.locator('#otp-code').fill(await recoverCode(E164))
  await otp.getByRole('button', { name: /Verify & continue/i }).click()
  await page.waitForTimeout(2500)

  const after = await page.locator('main').innerText()
  check('enquiry is accepted after verification', after.includes('Enquiry received'))
  await shot(page, 'enquiry-accepted')

  /*
   * Session persistence: on a different page, entering the SAME number must
   * be recognised as already verified. The notice only appears once a number
   * is typed, because until then there is nothing to compare against.
   */
  await page.goto(`${WEB}/contact`, { waitUntil: 'networkidle' })
  await page.locator('main h1').first().waitFor()
  await page.fill('input[name="mobile"]', PHONE)
  await page.waitForTimeout(400)
  check(
    'verified session is remembered on another page',
    (await page.locator('form').innerText()).includes('already verified on this device'),
  )
  await shot(page, 'session-persisted')

  // And a second enquiry goes through with no further verification.
  await page.fill('input[name="name"]', 'Verified Contractor')
  await page.fill('textarea[name="message"]', 'Following up on the DWC pipe requirement for site 2.')
  await page.getByRole('button', { name: /Send enquiry/i }).click()
  await page.waitForTimeout(2500)
  check(
    'second enquiry sends without a new code',
    (await page.locator('main').innerText()).includes('Enquiry received'),
  )
  await shot(page, 'second-enquiry')

  // Logging out must end the session.
  await page.evaluate(async () => {
    const csrf = document.cookie.match(/vh_customer_csrf=([^;]+)/)?.[1]
    await fetch('http://localhost:4000/api/visitor/logout', {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-Customer-CSRF-Token': decodeURIComponent(csrf) } : {},
    })
  })
  await page.goto(`${WEB}/contact`, { waitUntil: 'networkidle' })
  await page.locator('main h1').first().waitFor()
  await page.fill('input[name="mobile"]', PHONE)
  await page.waitForTimeout(400)
  check(
    'logging out clears the verified session',
    !(await page.locator('form').innerText()).includes('already verified on this device'),
  )

  await context.close()
}

await browser.close()
await db.end()

console.log('\nCONSOLE')
if (consoleErrors.length === 0) console.log('  PASS  no unexpected console errors')
else {
  console.log(`  FAIL  ${consoleErrors.length} console error(s)`)
  consoleErrors.slice(0, 6).forEach((e) => console.log(`        ${e}`))
  results.push({ name: 'console errors', ok: false })
}

const failed = results.filter((r) => !r.ok)
console.log('')
if (failed.length) {
  console.log(`${failed.length} FAILURE(S)`)
  process.exit(1)
}
console.log(`All ${results.length} visitor checks passed.`)
