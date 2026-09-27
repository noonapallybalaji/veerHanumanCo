/**
 * Content-Security-Policy verification.
 *
 * A CSP that has never been loaded in a browser is a guess. This serves the
 * real production build behind the exact policy from deploy/nginx.conf.example
 * — static files plus an /api proxy, the same shape nginx gives it — and
 * drives a browser over the public pages and the admin panel, failing on any
 * violation the page reports.
 *
 * Requires: `npm run build` (with VITE_API_BASE_URL unset, as in production,
 * where the SPA and API share one origin) and the API running on :4000.
 *
 *   node scripts/csp-check.mjs [distDir] [apiPort]
 */
import { createServer, request as httpRequest } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { chromium } from 'playwright'

const DIST = resolve(process.argv[2] ?? 'dist')
const API_PORT = Number(process.argv[3] ?? 4000)
const PORT = 4173

/**
 * The policy under test. Keep this identical to the commented block in
 * deploy/nginx.conf.example — if one changes, change both.
 */
export const CSP = [
  "default-src 'self'",
  // Vite emits module scripts as files; there are no inline scripts. The
  // JSON-LD blocks seo.tsx injects are data blocks, not executable script,
  // and are not covered by script-src.
  "script-src 'self'",
  // 'unsafe-inline' is required for style ATTRIBUTES, which React sets and
  // the <noscript> block uses. Tailwind itself ships as a static file.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // data: covers the inlined SVG illustrations; media uploads are served
  // from the same origin through /api/media.
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build at ${DIST}. Run: npm run build`)
  process.exit(1)
}

/** Mirrors the nginx layout: /api, /sitemap.xml and /robots.txt go upstream. */
const isProxied = (path) =>
  path.startsWith('/api/') || path === '/sitemap.xml' || path === '/robots.txt'

const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname

  if (isProxied(path)) {
    const upstream = httpRequest(
      { host: '127.0.0.1', port: API_PORT, path: req.url, method: req.method, headers: req.headers },
      (proxied) => {
        res.writeHead(proxied.statusCode ?? 502, proxied.headers)
        proxied.pipe(res)
      },
    )
    upstream.on('error', () => {
      res.writeHead(502).end('upstream unavailable')
    })
    req.pipe(upstream)
    return
  }

  // Resolve inside DIST only; normalize collapses any ".." before the check.
  const candidate = resolve(join(DIST, normalize(path)))
  const file =
    candidate.startsWith(DIST) && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : join(DIST, 'index.html')

  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Content-Security-Policy': CSP,
  })
  createReadStream(file).pipe(res)
})

await new Promise((done) => server.listen(PORT, done))
console.log(`\nServing ${DIST} on http://localhost:${PORT} with:\n  ${CSP}\n`)

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`)
}

const browser = await chromium.launch()
const context = await browser.newContext()
await context.addInitScript(() => {
  window.__csp = []
  document.addEventListener('securitypolicyviolation', (event) => {
    window.__csp.push(`${event.violatedDirective} blocked ${event.blockedURI}`)
  })
  try {
    sessionStorage.setItem('vh_welcome_seen', '1')
  } catch {
    /* blocked storage behaves the same way */
  }
})
const page = await context.newPage()

/**
 * A 401 from /api/auth/me is the correct answer to "am I signed in?" on the
 * login page, and browsers log every failed fetch. Same exclusion as
 * scripts/admin-check.mjs; everything else is a real error.
 */
const isExpected = (text, url) => text.includes('401') && url.includes('/admin/login')

const consoleErrors = []
page.on('console', (message) => {
  if (message.type() === 'error' && !isExpected(message.text(), page.url())) {
    consoleErrors.push(`[${page.url()}] ${message.text()}`)
  }
})

const PAGES = [
  '/',
  '/products',
  '/products/rcc',
  '/products/rcc/rcc-chambers',
  '/services/landscaping',
  '/projects',
  '/about',
  '/contact',
  '/request-quote',
  '/admin/login',
]

console.log('CSP VIOLATIONS')
for (const path of PAGES) {
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const violations = await page.evaluate(() => window.__csp ?? [])
  check(path, violations.length === 0, violations.slice(0, 2).join(' | '))
}

console.log('\nTHE PAGE STILL WORKS UNDER THE POLICY')
await page.goto(`http://localhost:${PORT}/products/rcc`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

check('React mounted', (await page.locator('#root *').count()) > 0)

/*
 * Rendered text alone proves nothing here: content/store.ts falls back to the
 * bundled seed data when the API is unreachable, so the page looks correct
 * even with every request blocked. Ask the page to call the API itself.
 */
const apiReachable = await page.evaluate(async () => {
  try {
    const response = await fetch('/api/public/content', { credentials: 'include' })
    if (!response.ok) return `HTTP ${response.status}`
    const body = await response.json()
    return Array.isArray(body.products) && body.products.length > 0 ? 'ok' : 'empty payload'
  } catch (error) {
    return `blocked: ${error instanceof Error ? error.message : String(error)}`
  }
})
check('the page can reach the API under the policy', apiReachable === 'ok', apiReachable)
check(
  'the webfont loaded',
  await page.evaluate(() =>
    [...document.fonts].some((font) => font.family.includes('Inter') && font.status === 'loaded'),
  ),
)
check(
  'stylesheet applied',
  await page.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'),
)

await browser.close()
server.close()

console.log('\nCONSOLE')
if (consoleErrors.length === 0) {
  console.log('  PASS  no console errors')
} else {
  console.log(`  FAIL  ${consoleErrors.length} console error(s)`)
  consoleErrors.slice(0, 6).forEach((error) => console.log(`        ${error}`))
  results.push({ name: 'console errors', ok: false })
}

const failed = results.filter((result) => !result.ok)
console.log('')
if (failed.length) {
  console.log(`${failed.length} FAILURE(S)`)
  process.exit(1)
}
console.log(`All ${results.length} CSP checks passed.`)
