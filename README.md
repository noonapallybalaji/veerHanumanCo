# Veer Hanuman Trading Co. — website + admin CMS

B2B enquiry-driven website for Veer Hanuman Trading Co. (also known as Veer
Hanuman Traders), a Hyderabad-based supplier and contractor for construction,
civil infrastructure, drainage and landscaping requirements — plus an admin
panel so the business can manage its own content without touching code.

The primary conversion is **Request a Quote**. There is deliberately no cart,
checkout, pricing or stock: quotations are prepared against each requirement.

**Stack:** React 19 · TypeScript (strict) · Vite · Tailwind · React Router ·
Express 5 · Prisma 7 · PostgreSQL

---

## Quick start

You need a PostgreSQL server. Anything works — a local install, a container,
or a free hosted database (Neon, Supabase, Railway). With Docker:

```bash
docker run --name vh-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=veerhanuman \
  -p 5432:5432 -d postgres:16-alpine
docker exec vh-pg psql -U postgres -c "CREATE DATABASE veerhanuman_test;"
```

Then:

```bash
npm install
cp .env.example .env         # fill AUTH_SECRET, IP_HASH_SALT, and the two DB URLs
npm run setup                # generate client, run migrations, seed catalogue
npm run admin:create         # create the first super admin (interactive)
npm run dev:all              # website on :5173, API on :4000
```

Sign in at <http://localhost:5173/admin/login>.

Generate the two required secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (website + admin) |
| `npm run dev:api` | API with reload |
| `npm run dev:all` | Both together |
| `npm run build` | Typecheck + production build, emits sitemap.xml and robots.txt |
| `npm start` | Run the API (production) |
| `npm test` | Full test suite (vitest). Uses `TEST_DATABASE_URL` and refuses any database not named `*_test`. |
| `npm run verify` | lint + typecheck + test + build, in that order |
| `npm run typecheck` | Strict typecheck across app, server and tooling |
| `npm run lint` | oxlint |
| `npm run smoke` | Server-renders all public routes and asserts content |
| `npm run db:migrate` | Create + apply a migration in development |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed the confirmed catalogue (idempotent) |
| `npm run db:studio` | Browse the database |
| `npm run admin:create` | Create a super admin |
| `npm run db:reset` | **Destructive.** Drops and recreates the schema. Guarded: refuses a non-local host, any database whose name contains `prod`, and `NODE_ENV=production`, and additionally requires `ALLOW_DESTRUCTIVE=yes`. |

Browser walkthroughs (need both servers running and
`npx playwright install chromium`):

```bash
node scripts/visual-check.mjs  http://localhost:5173 .screenshots   # public site
node scripts/admin-check.mjs   http://localhost:5173 .screenshots   # admin panel
node scripts/visitor-check.mjs http://localhost:5173 .screenshots   # welcome modal + OTP
node scripts/focus-check.mjs   http://localhost:5173                # modal keyboard focus
```

The Content-Security-Policy in [deploy/nginx.conf.example](deploy/nginx.conf.example)
is verified against a real build rather than assumed:

```bash
VITE_API_BASE_URL=http://localhost:4173 npx vite build --outDir dist-csp
node scripts/csp-check.mjs dist-csp 4000     # needs the API on :4000
```

It serves `dist-csp/` behind that exact policy — static files plus an `/api`
proxy, the shape nginx gives it — and fails on any violation the page
reports. If you change the policy, change it in both places and re-run this.

`visitor-check.mjs` needs `SMS_PROVIDER=console` and reads the code straight
from Postgres (brute-forcing the stored hash), so the server carries no
test-only "reveal the OTP" hook.

`focus-check.mjs` drives Tab and Escape through every modal — the welcome
modal, the OTP dialog stacked on it, the mobile nav panel and the admin
confirmation — and asserts focus never reaches the page behind. A focus trap
cannot be verified by reading markup; only the browser's behaviour proves it.

`admin-check.mjs` signs in, edits and publishes a product, moderates a
review, and asserts each change lands on the public site. It expects a super
admin to exist; override the account with `ADMIN_CHECK_EMAIL` and
`ADMIN_CHECK_PASSWORD`.

### Health endpoints

| Path | Purpose |
| --- | --- |
| `GET /api/health` | Liveness. Always `{"ok":true}` with `no-store`. Deliberately reveals nothing about version, dependencies or configuration — it is reachable from the internet. |
| `GET /api/ready` | Readiness. Checks the database with `SELECT 1` and reports whether SMS is configured. Returns **503** when the database is unreachable, so a load balancer stops sending traffic. |

Point the load balancer or systemd watchdog at `/api/ready`, not `/api/health`.

---

## Before launch — owner actions

Nothing below was invented to fill a gap, so a few things are deliberately
blank or hidden until you supply them. Each is a single change in the admin
panel — no code edits.

| # | What | Where | Why it is not filled in |
| - | ---- | ----- | ----------------------- |
| 1 | **Phone, WhatsApp, email** | Admin → Company & Contact | Not supplied. Every call/WhatsApp/email action is hidden until set, rather than linking to a wrong number. |
| 2 | **Production domain** | Admin → Company & Contact → website URL | Drives canonical URLs, Open Graph and the sitemap. |
| 3 | **Proprietor name / GSTIN** | Admin → Company & Contact → toggles | Third-party sourced. Hidden until you confirm and switch on. |
| 4 | **Warehouse address** | Same | Same. |
| 5 | **Coal, coal tar, granite/tiles, paver & tile fixing** | Admin → Company & Contact → Additional offerings | Reported by directories, several of which appear to belong to *different* businesses of a similar name in Mancherial, Haryana and Rajasthan. Not public until confirmed. |
| 6 | **Photographs** | Admin → any product/project → Image | None supplied; products fall back to built-in illustrations. |
| 7 | **Project references** | Admin → Projects | None supplied. `/projects` shows an honest "portfolio in preparation" state until you add one. |
| 8 | **SMS provider** | `.env` → `SMS_PROVIDER` | **Blocks launch.** Enquiries require a verified phone, and with `SMS_PROVIDER=none` every enquiry form is refused. Configure `twilio` or `webhook`. See below. |

### Configuring SMS

```bash
# Twilio
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_FROM="+15551234567"

# or your own gateway / Indian provider (MSG91, TextLocal, Gupshup)
SMS_PROVIDER=webhook
SMS_WEBHOOK_URL="https://your-relay.example.com/send"
SMS_WEBHOOK_TOKEN="..."      # optional, sent as a bearer token
```

The `webhook` provider POSTs `{ "to": "+9198...", "body": "..." }` and treats
any 2xx as delivered, so a small relay can adapt it to any gateway.

`SMS_PROVIDER=console` prints codes to the server log for development. The
server **refuses to start** with it in production.

**For India specifically:** transactional SMS to Indian numbers requires DLT
registration (sender ID and message template) with the operators. Twilio and
the Indian gateways both need this, and messages are dropped without it. Budget
a few days for approval. The OTP template is deliberately short and link-free
to fit DLT rules — see `otpMessage()` in `server/src/sms/index.ts`.

Nothing in this site claims a certification, award, rating, client name,
testimonial, project count, years of experience, price, stock level or
delivery guarantee, because none were supplied.

---

## Architecture

```
src/                      Public website + admin panel (one Vite app)
├── content/store.ts      Fetches published CMS content at boot
├── data/                 Seed + offline fallback, and the selector API
├── lib/                  api client, paths, contact, SEO, schema.org
├── admin/                Admin panel (code-split, loaded only at /admin)
├── components/           Public site components
└── pages/                Public routes

server/
├── prisma/schema.prisma  Database schema
├── prisma/seed.ts        Seeds the confirmed catalogue
├── scripts/create-admin  First super admin
├── src/routes/public.ts  Read-only public API + review/enquiry submission
├── src/routes/admin/*    Protected admin API
├── src/auth/             Argon2id hashing, sessions, RBAC, CSRF
├── src/services/         Serializers, audit log, content versions
└── tests/                API and authorisation tests
```

### How the website gets its content

`src/content/store.ts` fetches `/api/public/content` once at boot and writes
the result **into the seed modules in place**. The ~34 components that already
imported from `../data` keep working unchanged and keep a synchronous selector
API — no per-component loading states for a catalogue this small.

That relies on one rule, enforced by `src/main.tsx`: **hydration completes
before the app module is imported.** `main.tsx` awaits `hydrate()` and then
dynamically imports `./mount`. Adding a static `import App from './App'` to
`main.tsx` would evaluate module-level values (such as `contact.ts`'s
`hasPhone`) against the seed instead of live data.

If the API is unreachable the site renders the snapshot bundled with the
build. It is never written back to the database, and `getContentSource()`
reports which is in use.

### The catalogue hierarchy

```
PRODUCTS
├── RCC                     RCC Chambers · RCC Manhole Covers · RCC Poles · RCC Tree Guards
├── FRP Frame with Covers   Thermodrain · Gully
└── Pipes                   HDPE · EcoDrain · DWC

SERVICES
└── Landscaping
```

`Division → Category → Product`, and that is the only structure the catalogue
has. **Applications** and **requirement tags** are discovery dimensions: a
product carries many of either without changing which family it belongs to.
Never promote a discovery grouping into a category, and never re-parent a
product to make a filter return what you want — retag it instead.

Admins can add, edit, reorder, unpublish and archive families and products
freely; the *shape* is what is fixed, not the contents.

### Database

**PostgreSQL in every environment** — development, test and production — so
there is no dialect gap between what the tests exercise and what ships.

That is deliberate. An earlier SQLite-in-development setup would have shipped
two real bugs: SQLite-dialect migrations Postgres cannot apply (`DATETIME`
is not a Postgres type), and `contains` filters that are case-insensitive on
SQLite but case-sensitive on Postgres, which would have made every admin
search silently fail in production while working perfectly on a developer's
machine.

Two schema conventions remain, for their own reasons:

- **No `enum`** — status/role columns are `String`, validated by zod against
  `server/src/lib/constants.ts`, which is the authority on allowed values.
  Adding a status therefore needs no migration.
- **No `Json`** — structured fields are JSON-in-TEXT, read through
  `server/src/lib/json.ts`, which never throws on malformed data.

`server/src/db.ts` is the only file that knows which driver is in use.

Main tables: `AdminUser`, `Session`, `Division`, `Category`, `Product`,
`ProductImage`, `ProductDocument`, `Application`, `RequirementTag` (+ join
tables), `RelatedProduct`, `Service`, `Project`, `ProjectImage`,
`ProjectProduct`, `Review`, `ReviewEvent`, `ReviewReport`, `CompanyProfile`,
`AdditionalOffering`, `ContentPage`, `ContentSection`, `ContentVersion`,
`Media`, `Enquiry`, `EnquiryItem`, `EnquiryNote`, `AuditLog`.

Every content table carries `status`, timestamps and editor attribution, so
the draft/publish lifecycle and the audit trail work uniformly. Deletes are
avoided in favour of archiving; deleting a referenced product is refused.

**The test suite uses its own database.** `TEST_DATABASE_URL` must point at a
separate Postgres database whose name ends in `_test`; the suite refuses to
start otherwise, and `resetTables()` checks again before deleting anything.
Both guards exist because an earlier version of the suite truncated the
development data by accident.

---

## Security

| Concern | How it is handled |
| --- | --- |
| Passwords | Argon2id (19 MiB, 2 passes), 12-char minimum, common-password rejection |
| Sessions | Signed JWT in an httpOnly `SameSite=Lax` cookie, backed by a `Session` row so logout and role changes revoke instantly |
| CSRF | Double-submit token required on every state-changing admin request |
| Brute force | Per-IP rate limit plus per-account lockout after 5 failures |
| Account enumeration | Unknown email, wrong password and disabled account return one identical response |
| Authorisation | Permission-based (not role-based) checks on the server for every privileged route; the admin UI only hides controls as a convenience |
| Input | zod validation on every write; no raw HTML accepted anywhere |
| Uploads | Format detected from magic bytes, images re-encoded with sharp (strips EXIF and embedded payloads), random filenames, stored **outside the web root**, served through a controlled route with `nosniff` and a sandbox CSP |
| Injection | Prisma parameterises all queries; CSV export neutralises formula injection |
| Data leakage | Serializers are the single boundary; public responses never carry status, drafts, internal notes, IP hashes or gated fields |
| Logging | Never records passwords, tokens or raw IP addresses (salted hash only) |

Automated tests cover each of these — see `server/tests/`.

---

## Roles

| Role | Can |
| --- | --- |
| **Super admin** | Everything, including users, company settings and the audit log |
| **Content editor** | Create and edit products, projects and page content; save drafts and submit for review. **Cannot publish**, manage users or change settings |
| **Review moderator** | Moderate reviews only |

Roles map to permissions in `server/src/lib/constants.ts`; routes require a
permission, so adding a role later means editing one table, not every
endpoint.

---

## Reviews

Visitors submit reviews from a product page. **Nothing is ever published
automatically** — every review enters a `PENDING` queue and appears only once
a moderator approves it.

- Rejected, hidden and pending reviews never appear in public responses,
  review counts, averages, or structured data.
- Moderators can change a review's *visibility* and attach an internal reason,
  but there is no endpoint that edits the customer's words.
- Rejecting or hiding requires a recorded reason; every change writes an
  attributable `ReviewEvent`.
- `aggregateRating` is emitted in schema.org markup **only** when genuine
  approved reviews exist.
- There is no "verified purchase" badge, because there is no verification.

---

## Visitors, phone OTP and enquiries

### Phone verification is mandatory for enquiries

Every enquiry — contact page, quotation form, and the product and service
deep links into it — requires a phone verified by SMS OTP.

The gate is a server-side middleware (`requireVerifiedCustomer`) that accepts
only a live visitor session cookie, and that cookie is issued by exactly one
thing: a successful OTP verification. **No field in a request body can stand
in for it.** A client claiming `phoneVerified: true` is ignored and the
request is refused; there is a test for exactly that.

The enquiry is also recorded against the number that was *proved*, not the
one typed into the form, so a visitor cannot verify their own phone and then
submit under someone else's.

**If SMS is not configured, enquiries are refused.** There is no
"accept it unverified" fallback, because that would defeat the point. The
forms say so up front rather than letting someone fill in a form the server
will reject.

### The welcome modal

Shown once per browser session (`sessionStorage`), after a short delay, and
entirely skippable — escape, the backdrop, the close button and "Maybe later"
all dismiss it. It is never shown to a visitor who is already signed in.

Verification there is **optional**: submitting without it saves an
*unverified lead*, clearly flagged as such in the admin. Verifying also signs
the visitor in, so their later enquiry needs no second code.

### Passwordless login

A successful OTP verification *is* the authentication step. The server finds
the account for that number or creates one, then issues a session. Phone is
unique, so a returning visitor is logged into the account they already have
rather than acquiring a second one, and details supplied at verification only
fill gaps — they never overwrite an existing name.

Visitor sessions are **completely separate from admin sessions**: their own
table, their own cookie (`vh_customer`), their own CSRF header
(`X-Customer-CSRF-Token`) and a different JWT audience. An admin token
presented on the visitor cookie fails verification, and vice versa. Merging
the two behind a role column would put the admin panel one bug away from a
public login form.

### OTP security

| Control | Implementation |
| --- | --- |
| Storage | Only an HMAC-SHA256 of the code, keyed with `AUTH_SECRET` and salted with the phone number. The code itself is never written down. |
| Comparison | Constant-time, so response timing does not leak a partial match. |
| Expiry | `OTP_TTL_SECONDS` (default 5 min); expired challenges are consumed on use. |
| Single use | Consumed on success, and burned when attempts run out. |
| Attempts | `OTP_MAX_ATTEMPTS` (default 5) per challenge. |
| Resend cooldown | `OTP_RESEND_COOLDOWN_SECONDS` (default 45 s). |
| Per-number ceiling | `OTP_MAX_SENDS_PER_HOUR` (default 6), across all source addresses — the abuse that matters is cheap to spread across IPs. |
| Per-IP limits | Separate express rate limits on request and verify. |
| Send failure | The challenge is burned, so a code nobody received cannot be guessed. |

Rotating `AUTH_SECRET` invalidates every outstanding challenge and session.

### Admin visibility

- **Admin → Leads** lists welcome-modal captures with a prominent
  verified/not-verified badge, the source, and the marketing-consent flag.
- **Admin → Enquiries** shows a "Phone verified" badge and the source on
  every row. Rows created before this feature show "Unverified (legacy)".
- Consent is recorded in two separate fields: contact consent (required to
  submit) and marketing consent (optional, opt-in, default off).
- IP addresses are never stored raw or exposed — only a salted hash, and it
  is stripped from every admin response.

### If the API is unreachable

The form does **not** claim the message was delivered: it says so plainly and
hands the visitor their formatted requirement to send over WhatsApp instead.

---

## SEO

`<Seo>` sets title, description, canonical, Open Graph and JSON-LD per route.

### Dynamic sitemap

`sitemap.xml` and `robots.txt` are served by the API from the database
(`server/src/routes/sitemap.ts`), **not** generated at build time. Publishing
in the CMS is reflected on the next request — no rebuild, no redeploy.

Included: the canonical static pages, published product families, published
products, published services, and **published project detail URLs** by their
canonical slug.

Excluded: drafts, in-review, archived, `/admin`, `/api`, and any product whose
family is unpublished (it has no reachable URL, so listing it would be a soft
404).

The canonical origin comes from the CMS company profile ("production website
URL" in Admin → Company & Contact), falling back to `PUBLIC_SITE_URL`. It is
**never** derived from the request `Host` header — otherwise anyone who can
reach the server could mint a sitemap of absolute URLs on a domain of their
choosing. With no valid origin configured the route returns 503 rather than
guessing.

On a database error it returns **503 with `Retry-After`**, not a truncated
sitemap: crawlers then keep the copy they have, whereas a short sitemap would
wrongly imply the missing URLs had been withdrawn. The reason is logged
server-side and never returned.

Caching: `max-age=300, s-maxage=3600, stale-while-revalidate=86400`.

---

## Deployment

**[DEPLOYMENT.md](DEPLOYMENT.md) is the full runbook** — server setup, the
nginx and systemd templates in [deploy/](deploy/), TLS, backups, the upgrade
procedure and rollback. The summary below is the shape of it.

The server runs a configuration guard before it opens the listener
(`server/src/startup-checks.ts`). In production it **refuses to start** on a
placeholder or low-entropy `AUTH_SECRET`, on `IP_HASH_SALT` equal to
`AUTH_SECRET`, on `COOKIE_SECURE=false`, on `SMS_PROVIDER=console`, and on
any non-HTTPS CORS origin. Treat a refusal as the deploy failing, not as
something to work around.

1. Provision Postgres and set `DATABASE_URL` (add `?sslmode=require` for most
   managed providers).
2. Set `AUTH_SECRET`, `IP_HASH_SALT`, `COOKIE_SECURE=true`, `NODE_ENV=production`
   and `CORS_ORIGINS` to your real origin.
3. `npm ci && npm run db:deploy && npm run build`
4. Serve `dist/` as static files and run `npm start` for the API.
5. Put both behind one origin (e.g. nginx: `/api` → the API, everything else →
   `dist/`). Sharing an origin keeps the session cookie first-party.
6. **Route `/sitemap.xml` and `/robots.txt` to the API**, not to `dist/`.
   They are generated per request from the database. Without these rules the
   SPA fallback serves `index.html` at those paths and you publish HTML where
   crawlers expect XML:

   ```nginx
   location = /sitemap.xml { proxy_pass http://127.0.0.1:4000; }
   location = /robots.txt  { proxy_pass http://127.0.0.1:4000; }
   location /api/          { proxy_pass http://127.0.0.1:4000; }
   location /              { try_files $uri /index.html; }
   ```

   On Netlify/Vercel, add equivalent proxy rules **above** the SPA catch-all;
   order matters, the first match wins. Verify after deploy with
   `curl -i https://yourdomain/sitemap.xml` — the content type must be
   `application/xml`, not `text/html`.
7. **SPA rewrite is required** or deep links 404: nginx
   `try_files $uri /index.html;`, Netlify `/* /index.html 200`.
8. Persist `server/storage/` (uploaded media) and back up the database.
9. Set the production domain in **Admin → Company & Contact → website URL**.
   Until it is set, canonical tags fall back to the origin the page is served
   from and `/sitemap.xml` returns 503 — neither invents a domain, but both
   are wrong states to launch in.

### Migrations against a real database

`npm run db:deploy` (`prisma migrate deploy`) is the only migration command
that should ever touch production. It applies pending migrations forward and
never drops or resets anything. Before running it:

1. Take a `pg_dump` and confirm the dump file is non-empty.
2. Confirm `DATABASE_URL` names the database you intend — print the host and
   database name, not the whole URL with credentials.
3. Run `npx prisma migrate status --schema server/prisma/schema.prisma` first
   and read the pending list.

Never run `prisma migrate dev`, `prisma migrate reset` or `npm run db:reset`
against production. `db:reset` is wrapped by `server/scripts/guard-destructive.mjs`
and will refuse, but the guard is a backstop, not the policy.

### Backup and restore

- **Database:** `pg_dump` on a schedule; restore with `pg_restore`. Managed
  providers usually do this for you — check the retention window.
- **Media:** back up `server/storage/` separately — uploaded files are on
  disk, not in the database, so a database dump alone is not a full backup.

### Recovering admin access

Run `npm run admin:create` on the server to add a super admin. To rotate
secrets, change `AUTH_SECRET` and restart: every session is invalidated
immediately and everyone signs in again.

---

## Admin guide (for non-developers)

**Add a product.** Products → New product → fill in name, family, summary and
description → Create draft. It is not on the website yet. Add applications and
requirement tags so it shows up in the requirement finder, then press
**Publish**.

**Change a price-free detail on a live product.** Products → click it → edit →
Save changes. Published products update immediately.

**Take something off the website.** Open it and press **Unpublish**. It
disappears from the site but keeps its reviews and history. Use **Archive** for
things you do not expect to bring back. Neither deletes anything.

**Specifications.** Only add figures you can stand behind. Leaving the list
empty shows "Specifications available on request", which is better than a
guess.

**Add a project.** Projects → New project. A client is only named publicly if
you tick the box confirming they agreed, and a testimonial needs its own
consent tick. Publish when ready.

**Moderate a review.** Reviews → Pending. Read it, then **Approve & publish**
or **Reject** with a reason. You cannot edit what a customer wrote — if it is
unusable, reject it. Rejecting requires a reason so the decision is on record.

**Change the phone number.** Company & Contact → Phone → Save. The top bar,
header, footer, contact page, mobile bar and every WhatsApp link update
together.

**Edit homepage or About wording.** Website Content → pick the page → edit the
fields → Save. Leave a field blank to use the built-in wording. You can reorder
sections or switch them off; the design cannot be broken from here.

**Reply to an enquiry.** Enquiries → open one → call or email from the details
shown → set its status and add an internal note.

---

## Known limitations and next steps

1. **The sitemap needs a proxy rule.** It is served by the API, so
   `/sitemap.xml` and `/robots.txt` must be routed there rather than to the
   static bundle — see step 6 under Deployment. Get this wrong and the SPA
   fallback serves HTML at both paths.
2. **Client-rendered metadata.** Titles and JSON-LD are set after hydration.
   Modern crawlers execute this, but prerendering or SSR would be stronger if
   organic search becomes a priority.
3. **No email notifications.** New enquiries and pending reviews appear in the
   dashboard but nobody is emailed. Next step: a server-side provider behind an
   env var, with the UI degrading honestly when unset.
4. **Content versions are recorded but not restorable from the UI.** Snapshots
   are written on publish and before destructive edits, and the API can list
   and read them; a compare-and-restore screen is not built.
5. **Product gallery and document upload** exist in the schema and API but the
   admin form currently exposes only the main image.
6. **Four `npm audit` advisories** come from the Prisma CLI's own dev
   dependencies (`@prisma/config` → `deepmerge-ts`, and `mysql2`). They are
   dev-only and not reachable at runtime.
7. **Rate limits are disabled under `NODE_ENV=test`** so the suite can submit
   freely; one dedicated test re-enables them to prove the limiter fires.
8. **Vite config warning.** `npm run build` warns that `vite.config.ts` imports
   `./src/data/catalogue` without a file extension. That import keeps the
   sitemap in sync with the catalogue; it is a forward-compatibility notice
   about a future config loader, not an error.
