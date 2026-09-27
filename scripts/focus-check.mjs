/**
 * Keyboard focus management in the modal dialogs.
 *
 * A focus trap is one of the few accessibility features that cannot be
 * checked by reading the markup: the whole behaviour is what the browser
 * does on Tab. So this drives a real browser and asserts where focus lands.
 *
 * Covers the welcome modal, the OTP dialog stacked on top of it, the mobile
 * navigation panel and the admin confirmation dialog.
 *
 *   node scripts/focus-check.mjs [webUrl] [adminEmail] [adminPassword]
 */
import { chromium } from 'playwright'

const WEB = process.argv[2] ?? 'http://localhost:5176'
const EMAIL = process.env.ADMIN_CHECK_EMAIL ?? 'owner@veerhanumantrading.com'
const PASSWORD = process.env.ADMIN_CHECK_PASSWORD ?? 'Trenchline-Kestrel-2026'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`)
}

/** Is the currently focused element inside the given selector? */
const focusInside = (page, selector) =>
  page.evaluate((sel) => {
    const container = document.querySelector(sel)
    return Boolean(container && document.activeElement && container.contains(document.activeElement))
  }, selector)

const focusDescription = (page) =>
  page.evaluate(() => {
    const el = document.activeElement
    if (!el) return 'none'
    const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 24) ?? ''
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} ${label}`.trim()
  })

/**
 * Tabs `count` times and reports whether focus ever left the container.
 * More than one full cycle, so a trap that only wraps once is still caught.
 */
async function tabStaysInside(page, selector, count) {
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press('Tab')
    if (!(await focusInside(page, selector))) return { ok: false, at: i + 1 }
  }
  return { ok: true }
}

const browser = await chromium.launch()

/* ------------------------------------------------- 1. Welcome modal ---- */

console.log('\nWELCOME MODAL')
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto(WEB, { waitUntil: 'networkidle' })

  const dialog = '[role="dialog"][aria-labelledby="welcome-title"]'
  await page.waitForSelector(dialog, { timeout: 10000 })
  await page.waitForTimeout(300)

  check('focus moves into the dialog on open', await focusInside(page, dialog), await focusDescription(page))

  const forward = await tabStaysInside(page, dialog, 24)
  check('Tab never escapes the dialog', forward.ok, forward.ok ? '' : `left at Tab ${forward.at}`)

  for (let i = 0; i < 24; i += 1) await page.keyboard.press('Shift+Tab')
  check('Shift+Tab never escapes the dialog', await focusInside(page, dialog), await focusDescription(page))

  // Focus deliberately dropped outside; the trap should reclaim it.
  await page.evaluate(() => document.body.focus())
  await page.keyboard.press('Tab')
  check('focus is pulled back if it escapes', await focusInside(page, dialog))

  /* --------------------------------- 2. OTP dialog stacked on top ------ */

  console.log('\nOTP DIALOG (stacked on the welcome modal)')
  await page.locator(`${dialog} label:has-text("Your name") input`).fill('Focus Test')
  await page.locator(`${dialog} label:has-text("Mobile number") input`).fill('9876500011')
  await page.locator(`${dialog} input[type=checkbox]`).first().check()
  await page.getByRole('button', { name: /Verify number/ }).click()

  const otp = '[role="dialog"][aria-labelledby="otp-title"]'
  await page.waitForSelector(otp, { timeout: 15000 })
  await page.waitForTimeout(1200)

  check('focus moves into the OTP dialog', await focusInside(page, otp), await focusDescription(page))
  check('and is no longer in the welcome modal', !(await focusInside(page, dialog)))

  const otpTab = await tabStaysInside(page, otp, 16)
  check('Tab stays inside the OTP dialog', otpTab.ok, otpTab.ok ? '' : `left at Tab ${otpTab.at}`)

  // The outer modal must not steal Escape while the OTP dialog is open.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('Escape closes only the OTP dialog', (await page.locator(otp).count()) === 0)
  check('the welcome modal is still open behind it', (await page.locator(dialog).count()) === 1)
  check(
    'and the typed details survived',
    (await page.locator(`${dialog} label:has-text("Your name") input`).inputValue()) === 'Focus Test',
  )

  await context.close()
}

/* --------------------------------------------- 3. Mobile navigation ---- */

console.log('\nMOBILE NAVIGATION PANEL')
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('vh_welcome_seen', '1')
    } catch {
      /* blocked storage behaves the same way */
    }
  })
  const page = await context.newPage()
  await page.goto(WEB, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /menu/i }).first().click()
  await page.waitForTimeout(400)

  const panel = '.fixed.inset-0.z-\\[60\\]'
  check('panel is open', (await page.locator(panel).count()) === 1)
  check('focus moves into the panel', await focusInside(page, panel), await focusDescription(page))

  const navTab = await tabStaysInside(page, panel, 30)
  check('Tab cannot reach the page behind it', navTab.ok, navTab.ok ? '' : `left at Tab ${navTab.at}`)

  await context.close()
}

/* ------------------------------------------ 4. Admin confirm dialog ---- */

console.log('\nADMIN CONFIRMATION DIALOG')
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/admin', { timeout: 15000 })

  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await page.locator('h1').first().waitFor()
  await page.waitForTimeout(600)
  await page.getByRole('link', { name: 'RCC Poles' }).first().click()
  await page.locator('h1').first().waitFor()
  await page.waitForTimeout(600)

  // Unpublish opens the confirmation dialog; we cancel out of it.
  await page.getByRole('button', { name: 'Unpublish' }).first().click()
  const confirm = '[role="dialog"][aria-labelledby="confirm-title"]'
  await page.waitForSelector(confirm, { timeout: 8000 })
  await page.waitForTimeout(300)

  check('focus moves into the confirmation', await focusInside(page, confirm), await focusDescription(page))

  const confirmTab = await tabStaysInside(page, confirm, 14)
  check('Tab cannot reach the editor behind it', confirmTab.ok, confirmTab.ok ? '' : `left at Tab ${confirmTab.at}`)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('Escape cancels without publishing state changing', (await page.locator(confirm).count()) === 0)

  await context.close()
}

await browser.close()

const failed = results.filter((result) => !result.ok)
console.log('')
if (failed.length) {
  console.log(`${failed.length} FAILURE(S)`)
  process.exit(1)
}
console.log(`All ${results.length} focus checks passed.`)
