# Pre-launch audit — Veer Hanuman Trading Co.

Audit date: 2026-09-26. Covers the repository at `D:\veerHanuman`.

**Verdict: not ready to go public.** The code is ready; the business inputs
are not. The items below need the owner or a provider, and four are hard
blockers — with them unset the site has no working enquiry path.

*Update 2026-09-26: the owner supplied the WhatsApp number `8712002048`. It
is set (stored as `918712002048`) and verified rendering across breakpoints.
Phone and email are still blank.*

Nothing in this document was verified against a real server, domain or SMS
provider, because none was available. Items that need that are marked
**Needs live verification** and must not be counted as done.

---

## 1. Audit summary

| Area | Status | Note |
| ---- | ------ | ---- |
| Admin authentication (Argon2id, server sessions, lockout) | **Pass** | Covered by `server/tests/auth.test.ts` |
| Admin/visitor session isolation | **Pass** | Separate cookies, separate JWT audiences; a visitor session cannot reach `/api/admin/*` |
| CSRF (double-submit, both session kinds) | **Pass** | Enforced at the router mount, not per route |
| Permission-based RBAC | **Pass** | `ROLE_PERMISSIONS`, tested per role |
| Server-enforced OTP before an enquiry is saved | **Pass** | The server re-checks its own cookie; no frontend flag is trusted |
| OTP storage (HMAC-SHA256, salted, single-use, expiry, attempt + rate caps) | **Pass** | Codes are never stored or logged in plaintext outside the console dev provider |
| Rate limiting | **Pass** | Global + per-endpoint; one test re-enables limits to prove the limiter fires |
| Upload handling (magic bytes, sharp re-encode, storage outside webroot) | **Pass** | EXIF and embedded payloads are stripped by re-encoding |
| Input validation (zod on every write route) | **Pass** | |
| Security headers from the API | **Pass** | helmet; `X-Powered-By` removed |
| Content-Security-Policy | **Fixed this pass** | Was left commented out in the nginx template. Now set, and **verified in a browser** against the real build |
| Modal keyboard focus management | **Fixed this pass** | No dialog trapped focus. Now trapped and **verified in a browser** |
| Hardcoded unconfirmed production domain | **Fixed this pass** | See §2.1 — this was the most serious finding |
| Health / readiness endpoints | **Pass** | `/api/health` leaks nothing; `/api/ready` returns 503 when the DB is down |
| Production config guard | **Pass** | Refuses to boot on placeholder secrets, `COOKIE_SECURE=false`, `SMS_PROVIDER=console`, non-HTTPS CORS |
| Destructive command guard | **Pass** | `npm run db:reset` refuses non-local hosts, `*prod*` names, `NODE_ENV=production` |
| Admin panel excluded from indexing | **Pass** | `noindex, nofollow, noarchive` while the admin routes are mounted |
| Sitemap correctness | **Pass** | Drafts, unpublished projects, `/admin` and `/api` excluded; refuses to guess an origin |
| No fabricated business data | **Pass** | Re-swept this pass; see §2.1 for the one violation found and removed |
| Floating WhatsApp button | **Added this pass** | Live with the owner's number; desktop-only (see §2.5) and hidden entirely when no number is configured |
| **Public contact details** | **Partly supplied** | WhatsApp confirmed 2026-09-26; phone and email still missing |
| **SMS provider + DLT registration** | **Needs owner input** | Blocker |
| **Production domain** | **Needs owner input** | Blocker |
| **TLS, server, DNS, backups** | **Needs live verification** | Blocker |
| Real SMS delivery to a handset | **Needs live verification** | Cannot be simulated |

---

## 2. Changes made this pass

### 2.1 Removed a hardcoded, unconfirmed production domain — *launch-critical*

`src/data/company.ts` carried `siteUrl: 'https://www.veerhanumantrading.com'`.
That domain was never supplied. Every canonical tag, every `og:url`, every
schema.org `@id` and the seeded CMS company profile were pointing at a host
nobody has confirmed exists. It had also been seeded into the local database
and into `.env.example`.

A canonical tag pointing at a domain the business does not own is worse than
having none: it tells search engines the real page is a duplicate of
something else.

- `companyConfig.siteUrl` is now `''`.
- New `src/lib/site.ts` — `siteOrigin()` / `absoluteUrl()` / `schemaId()`.
  Uses the configured domain when set; otherwise falls back to the origin the
  page is served from. It never invents a host: with nothing configured,
  `absoluteUrl('/about')` returns `/about`, and `schemaId('organization')`
  returns the document-relative `#organization`.
- `src/lib/seo.tsx` and `src/lib/schema.ts` now go through it. `url` is
  omitted from the organization and website schemas rather than emitted
  empty.
- `.env.example` `PUBLIC_SITE_URL` is blank with an explanatory comment.
- The value was cleared from the **local development** database
  (`CompanyProfile.siteUrl`, one field, non-destructive). `/sitemap.xml` now
  correctly returns 503 there instead of publishing guessed URLs.
- 10 tests in `src/lib/site.test.ts`.

### 2.2 Focus trapping in every modal

No dialog on the site trapped keyboard focus. Tab walked straight out of the
welcome modal, the OTP dialog and the admin confirmation into the page
behind — a keyboard or screen-reader user ended up operating controls they
could not see, including, in the admin case, the editor behind a destructive
confirmation. WCAG 2.4.3 / 2.1.2.

- New `src/lib/useFocusTrap.ts`. Moves focus in on open, wraps at both ends,
  reclaims focus if it escapes, restores the previous element on close.
- Wired into `WelcomeModal`, `OtpDialog`, the admin `ConfirmProvider` and the
  mobile navigation panel.
- Two stacking bugs found and fixed while doing it:
  - the welcome modal's trap fought the OTP dialog's when the two were open
    together, so the outer trap now suspends while the inner one is up, and
    the restore step no longer yanks focus out of a dialog stacked on top;
  - Escape closed *both* dialogs at once, discarding everything the visitor
    had typed. The outer modal now ignores Escape while the OTP dialog owns it.

### 2.3 Content-Security-Policy — set and actually verified

The nginx template had CSP commented out with "left for you to set". It is
now set, and the policy was derived by testing rather than by guessing:
`scripts/csp-check.mjs` serves the real production build behind that exact
header — static files plus an `/api` proxy, the shape nginx gives it — and
drives a browser over ten routes, failing on any violation the page reports.

The first run failed and was informative: it showed that `connect-src 'self'`
only works because the SPA and API share an origin, which is now called out
in the config comment. It also caught a weak assertion of my own — the page
renders correctly from bundled seed data even with every API call blocked, so
"the text looks right" proved nothing. The check now makes the page call the
API itself.

Final result: **0 violations across all ten routes**, fonts and stylesheet
load, API reachable.

### 2.4 Smaller fixes

- `scripts/admin-check.mjs`: credentials now overridable via
  `ADMIN_CHECK_EMAIL` / `ADMIN_CHECK_PASSWORD`; removed a dead variable.
- `FloatingWhatsApp`: route rule extracted to a testable `showsOnRoute()`,
  and tightened so `/administration` is no longer treated as an admin path.
- `vitest.config.ts`: now also picks up `src/**/*.test.ts`; corrected a
  comment still describing the SQLite era.
- `.env.example`: `COOKIE_SECURE` now states that production refuses to boot
  without it.
- README: `npm run verify`, the guarded `db:reset`, the health endpoints, a
  link to `DEPLOYMENT.md`, and a **safe production migration procedure**
  (dump first, check `migrate status`, `migrate deploy` only).

### 2.5 Floating WhatsApp button — number set, and made desktop-only

The owner supplied `8712002048` on 2026-09-26. It is stored as
`918712002048` (wa.me and `tel:` both need the country code) in the CMS
company profile and as the seed/offline value in `src/data/company.ts`.
`phone` and `email` remain blank — they were not supplied, and were **not**
assumed to be the same number.

Verifying it in a browser turned up a genuine problem: on mobile the
floating circle sat about 20px above `MobileActionBar`'s full-width WhatsApp
button — the same action twice, stacked. The floating button is now
`hidden lg:inline-flex`, so below the `lg` breakpoint the action bar owns
WhatsApp and above it the floating pill does.

Verified across breakpoints: shown at 1280 and 1024 on `/`, product, service,
projects and about; hidden on `/contact` and `/request-quote` at every width;
hidden at 390 where the action bar takes over. Every `wa.me` link on every
page points at the right number (0 wrong across 7 pages).

---

## 3. Tests run

Everything below was executed and the output observed.

| Suite | Command | Result |
| ----- | ------- | ------ |
| Unit + API | `npx vitest run` | **120 passed**, 10 files |
| Typecheck | `npx tsc -b` | **exit 0** |
| Lint | `npm run lint` (oxlint) | **0 errors**, 25 pre-existing warnings |
| Production build | `npm run build` | **exit 0** |
| SSR smoke | `npm run smoke` | **18/18 passed** |
| Public site (browser) | `node scripts/visual-check.mjs` | **all passed** |
| Admin panel (browser) | `node scripts/admin-check.mjs` | **18/18 passed** |
| Visitor + OTP (browser) | `node scripts/visitor-check.mjs` | **16/16 passed** |
| Modal focus (browser) | `node scripts/focus-check.mjs` | **16/16 passed** |
| CSP (browser) | `node scripts/csp-check.mjs` | **14/14 passed** |

New tests added: 12 for the startup config guard, 10 for origin resolution,
4 for the WhatsApp route rule, 16 browser focus checks, 14 browser CSP checks.

All test runs used the isolated `veerhanuman_test` database.
`server/tests/setup-env.ts` refuses to run against any database whose name
does not end in `_test`, so no development or production data was touched.

**Known flake:** one `npm run verify` run failed with a single 30-second test
timeout; the immediate re-run passed 120/120. I did not isolate which test,
so this is an open item, not a clean result.

**Not verified, and not simulated:** real SMS delivery, TLS, DNS, the live
domain, nginx and systemd under load, and backup/restore. Those need the
actual server.

---

## 4. Owner and provider actions

Nothing here can be done from the repository.

| # | Item | Where | Blocker? |
| - | ---- | ----- | -------- |
| 1a | ~~Public **WhatsApp** number~~ | Done — `918712002048`, confirmed by the owner 2026-09-26 | Resolved |
| 1b | Public **phone** and **email** | Admin → Company & Contact | No, but the site currently offers no way to call or email. Not assumed to be the same as the WhatsApp number. |
| 2 | **SMS provider** account + credentials (Twilio or an Indian gateway) | `.env` → `SMS_PROVIDER` | **Yes.** With `none`, every enquiry form is refused by design. |
| 3 | **DLT registration** (India): entity ID, sender ID, approved OTP template | Provider console | **Yes.** Indian operators drop unregistered transactional SMS, so OTPs silently never arrive. |
| 4 | **Production domain** + DNS control | Registrar, then Admin → Company & Contact → website URL | **Yes.** Canonical URLs, Open Graph and sitemap.xml all derive from it; `/sitemap.xml` returns 503 until set. |
| 5 | **VPS + TLS certificate** | Hosting provider | **Yes.** |
| 6 | Confirm or reject **proprietor name and GSTIN** | Admin → disclosure toggles | No — hidden until confirmed |
| 7 | Confirm or reject **coal, coal tar, white coal, granite/tiles, paver fixing, tile fixing** | Admin → Additional offerings | No — hidden until confirmed. Several source listings appear to belong to *different* businesses of a similar name. |
| 8 | **Project photographs and references**, with written client permission | Admin → Projects | No — `/projects` shows an honest "in preparation" state |
| 9 | **Off-site backup destination** | S3 / Backblaze / rclone | No, but do it before real enquiries arrive |

---

## 5. Deployment

The runbook is **[DEPLOYMENT.md](DEPLOYMENT.md)**: server prep, Postgres,
environment, migrations, systemd, nginx + TLS, post-deploy verification,
backups, upgrade and rollback, SMS setup, monitoring. Templates are in
[deploy/](deploy/).

Two things worth repeating here:

1. **`/sitemap.xml` and `/robots.txt` must be routed to the API**, not to
   `dist/`. Without those rules the SPA fallback serves `index.html` and you
   publish HTML where crawlers expect XML.
2. **`npm run db:deploy` is the only migration command that should ever touch
   production.** Take a `pg_dump` first, check `prisma migrate status`, then
   apply. Never `migrate dev`, `migrate reset` or `db:reset` — `db:reset` is
   guarded and will refuse, but the guard is a backstop, not the policy.

The server runs `server/src/startup-checks.ts` before opening the listener
and **refuses to start** in production on a placeholder or low-entropy
`AUTH_SECRET`, on `IP_HASH_SALT` equal to `AUTH_SECRET`, on
`COOKIE_SECURE=false`, on `SMS_PROVIDER=console`, or on any non-HTTPS CORS
origin. A refusal is the deploy failing, not something to work around.

---

## 6. Launch checklist

### Pass — verified here

- [x] Admin auth, session isolation, CSRF, RBAC
- [x] OTP enforced server-side before any enquiry is saved
- [x] Rate limiting active, limiter proven to fire
- [x] Upload validation and re-encoding
- [x] Security headers; CSP set and browser-verified
- [x] Modal focus management, browser-verified
- [x] Admin panel excluded from indexing
- [x] Sitemap excludes drafts, unpublished projects, `/admin`, `/api`
- [x] No fabricated contact details, reviews, projects, specs, prices or domain
- [x] Production config guard and destructive-command guard
- [x] Health and readiness endpoints
- [x] 120 tests, typecheck, lint, build, SSR smoke, 4 browser suites

### Pending — needs the owner or a provider

- [x] WhatsApp number set (`918712002048`) and verified rendering
- [ ] Phone and email set in the admin panel
- [ ] SMS provider configured; `/api/ready` reports `smsConfigured: true`
- [ ] DLT registration complete (India)
- [ ] Production domain registered, DNS pointed, set in the admin panel
- [ ] VPS provisioned, TLS issued, HSTS confirmed
- [ ] Super admin created with a real password (no default exists anywhere)
- [ ] Off-site backups running and a **restore actually tested**
- [ ] Uptime monitoring on `/api/ready`

### Blocked — cannot be done from here at all

- [ ] **Confirm an OTP SMS arrives on a real handset.** No automated test can
      prove this. It is the single most important pre-launch check.
- [ ] `curl -sI https://<domain>/sitemap.xml` returns `application/xml`
- [ ] Session cookie shows `Secure`, `HttpOnly`, `SameSite=Lax` on the live site
- [ ] Submit one real end-to-end enquiry and confirm it lands in the admin panel

---

## 7. Known risks

1. **SMS delivery is entirely unproven.** The code path is tested against the
   console provider, which exercises generation, hashing, expiry and attempt
   limits — but not delivery. If DLT registration is missing or the template
   is unapproved, OTPs will silently never arrive and **every enquiry will
   fail** while the server logs look healthy. Test with a real handset before
   announcing the site.

2. **One unisolated flaky test.** A 30s timeout on one run, clean on the
   next. Probably a slow database call under load, but unconfirmed. Run the
   suite a few times before trusting it in CI.

3. **Single point of failure.** One VPS, one Postgres, media on local disk.
   Appropriate for this site's traffic, but there is no failover: if the disk
   fills, uploads and Postgres fail together. Monitor disk space.

4. **Media is not in the database.** A `pg_dump` alone is not a full backup —
   `server/storage/` must be backed up separately, or restored sites come back
   with every image missing.

5. **The catalogue is text-only.** No specifications, prices or stock were
   supplied, so product pages describe rather than specify. That is the honest
   state, but it limits SEO and gives buyers less to act on than competitors
   who publish dimensions. Worth filling in when the owner can supply real data.

6. **No photographs of actual work.** Products fall back to built-in
   illustrations, labelled as illustrations. `/projects` is empty by design.
   For a construction supplier this is the biggest credibility gap on the
   site, and it is a content problem, not a code one.

7. **`connect-src 'self'` assumes one origin.** If the API is ever moved to a
   separate hostname, the CSP silently breaks every API call. The constraint
   is documented in the nginx config and enforced by `scripts/csp-check.mjs`.

8. **Rotating `AUTH_SECRET` signs everyone out**, admins and verified
   visitors alike. Intentional, but do it deliberately, not during business
   hours.
