# Deployment runbook — Veer Hanuman Trading Co.

**Status: not deployed.** Nothing in this document has been executed against
a real server. No hosting provider, domain, SMS account or credentials were
available while it was written, so every host-specific value is a marked
placeholder.

No deployment target was selected, so this targets **a single Linux VPS with
Nginx and PostgreSQL** — the simplest setup that fits this application
(SQLite-style single-server assumptions do not apply; Postgres is required,
and uploaded media needs persistent disk).

> **Serverless/edge hosts (Vercel, Netlify Functions, Cloudflare Workers) are
> not suitable as-is.** The app writes uploaded media to local disk and holds
> a Postgres connection pool. Either would need replacing (object storage and
> a pooler) before a serverless deploy.

---

## 0. Owner/provider action required

These cannot be completed from the repository. **The site must not go public
until every one is done.**

| # | Item | Needed for |
| - | ---- | ---------- |
| 1 | **Public WhatsApp number**, international format | The floating button, header, footer, product pages and mobile bar all stay hidden without it |
| 2 | **Phone + email** for the business | Contact page, top bar, schema.org |
| 3 | **SMS provider account** (Twilio or an Indian gateway) + credentials | **Blocks launch** — without it every enquiry form is refused |
| 4 | **DLT registration** (India): entity ID, sender ID, approved OTP template | Indian operators drop unregistered transactional SMS |
| 5 | **Domain + DNS control** | HTTPS, canonical URLs, sitemap |
| 6 | **VPS** (2 GB RAM is ample) with root/sudo | Everything |
| 7 | **Approved company content** — proprietor name and GSTIN are third-party sourced and hidden behind toggles; project photos and any testimonial need written client permission | Legal/accuracy |
| 8 | **Off-site backup destination** (S3, Backblaze, rclone remote) | Backups on the same disk protect against almost nothing |

---

## 1. Prerequisites

- Ubuntu 22.04/24.04 LTS (or similar), root or sudo
- Node.js **20.19+** (`engines` in package.json pins `>=20.19 <23`)
- PostgreSQL 15+
- Nginx
- A domain pointed at the server

### DNS records

| Type | Name | Value | Notes |
| ---- | ---- | ----- | ----- |
| A | `@` | `<SERVER_IPV4>` | |
| A | `www` | `<SERVER_IPV4>` | Or CNAME to the apex |
| AAAA | `@` | `<SERVER_IPV6>` | Only if the VPS has IPv6 |

Wait for propagation (`dig +short <YOUR_DOMAIN>`) **before** requesting
certificates — certbot fails otherwise.

---

## 2. Server preparation

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql git curl ufw

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Firewall: only SSH and HTTP(S). Postgres stays on localhost.
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable

# Service account, no login shell
sudo useradd --system --create-home --shell /usr/sbin/nologin veerhanuman
sudo mkdir -p /var/www/veerhanuman /var/lib/veerhanuman/storage /etc/veerhanuman
sudo chown -R veerhanuman:veerhanuman /var/www/veerhanuman /var/lib/veerhanuman
sudo chmod 750 /etc/veerhanuman
```

---

## 3. Database

Create a database and a user **with no more rights than the app needs** — it
never needs to create databases or roles.

```bash
sudo -u postgres psql <<'SQL'
CREATE USER veerhanuman WITH PASSWORD '<STRONG_PASSWORD>';
CREATE DATABASE veerhanuman OWNER veerhanuman;
\c veerhanuman
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO veerhanuman;
SQL
```

The app owns its schema because Prisma Migrate creates and alters tables. If
you prefer a separate migration role, run migrations as the owner and the app
as a restricted user — document whichever you choose.

Confirm Postgres is **not** listening publicly:

```bash
sudo ss -lntp | grep 5432      # expect 127.0.0.1:5432 only
```

---

## 4. Application

```bash
sudo -u veerhanuman git clone <YOUR_REPO_URL> /var/www/veerhanuman
cd /var/www/veerhanuman
sudo -u veerhanuman npm ci
```

### Environment

Secrets live outside the repo, root-owned, readable only by the service user.

```bash
sudo cp .env.example /etc/veerhanuman/api.env
sudo chown root:veerhanuman /etc/veerhanuman/api.env
sudo chmod 640 /etc/veerhanuman/api.env
sudo nano /etc/veerhanuman/api.env
```

Generate the two secrets — do not invent them by hand:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"  # IP_HASH_SALT
```

Production values that differ from the development defaults:

```ini
NODE_ENV=production
COOKIE_SECURE=true                       # REQUIRED; the app refuses to start without it
CORS_ORIGINS="https://<YOUR_DOMAIN>"     # HTTPS only, no localhost
PUBLIC_SITE_URL="https://<YOUR_DOMAIN>"
DATABASE_URL="postgresql://veerhanuman:<STRONG_PASSWORD>@localhost:5432/veerhanuman"
MEDIA_LOCAL_DIR="/var/lib/veerhanuman/storage"
SMS_PROVIDER=twilio                      # never "console" in production
```

`server/src/startup-checks.ts` refuses to start on placeholder secrets,
`COOKIE_SECURE=false`, `SMS_PROVIDER=console`, or non-HTTPS CORS origins.
That guard is deliberate — do not work around it.

### Migrations

```bash
cd /var/www/veerhanuman
sudo -u veerhanuman npx prisma generate
sudo -u veerhanuman npx prisma migrate deploy      # additive; never resets
```

- **`migrate deploy` only.** It applies pending migrations and never drops
  anything.
- **Never run `npm run db:reset` or `prisma migrate reset` on production.**
  `db:reset` is wrapped by `server/scripts/guard-destructive.mjs`, which
  refuses any non-local host, any database named `*prod*`, and
  `NODE_ENV=production`. Treat that guard as a backstop, not permission.
- **Never run `npm run db:seed` on a live database.** It is idempotent, but
  it is for bootstrapping a fresh install only.
- **Take a backup before every migration** (section 8).

### Build and first admin

```bash
sudo -u veerhanuman npm run build        # emits dist/

# Interactive; no default password exists anywhere in this project.
cd /var/www/veerhanuman
sudo -u veerhanuman --preserve-env=PATH npx tsx server/scripts/create-admin.ts
```

---

## 5. Process management

```bash
sudo cp deploy/veerhanuman-api.service.example /etc/systemd/system/veerhanuman-api.service
sudo nano /etc/systemd/system/veerhanuman-api.service   # replace placeholders
sudo systemctl daemon-reload
sudo systemctl enable --now veerhanuman-api
sudo systemctl status veerhanuman-api
journalctl -u veerhanuman-api -n 50
```

The unit restarts on crash with back-off, drains in-flight requests on
SIGTERM, and runs with a read-only filesystem apart from the media directory.

---

## 6. Nginx and HTTPS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/veerhanuman
sudo nano /etc/nginx/sites-available/veerhanuman        # replace <YOUR_DOMAIN>
sudo ln -s /etc/nginx/sites-available/veerhanuman /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <YOUR_DOMAIN> -d www.<YOUR_DOMAIN>
sudo systemctl status certbot.timer                     # auto-renewal
```

### The routing rule that is easy to get wrong

`/sitemap.xml` and `/robots.txt` are generated **by the API from the
database**, not built into `dist/`. They must be proxied to the API. Without
those two rules the SPA fallback serves `index.html` and you publish HTML
where crawlers expect XML. The example config has them; verify after deploy.

---

## 7. Post-deploy verification

Run these against the live domain and read the output — do not assume.

```bash
curl -fsS  https://<YOUR_DOMAIN>/api/health                    # {"ok":true}
curl -fsS  https://<YOUR_DOMAIN>/api/ready                     # ready + checks
curl -sI   https://<YOUR_DOMAIN>/sitemap.xml | grep -i content-type   # application/xml
curl -sI   https://<YOUR_DOMAIN>/robots.txt  | grep -i content-type   # text/plain
curl -sI   https://<YOUR_DOMAIN>/products/rcc | head -1         # 200, not 404
curl -s    https://<YOUR_DOMAIN>/robots.txt | grep Sitemap      # absolute https URL
curl -sI   https://<YOUR_DOMAIN>/ | grep -i strict-transport    # HSTS present
```

Then in a browser:

- **Admin → Company & Contact → website URL is set to the live domain.** Until
  it is, canonical tags fall back to the served origin and `/sitemap.xml`
  returns 503. Nothing guesses a domain, but neither is a launch state.
- `/api/ready` reports `smsConfigured: true`
- Submit a test enquiry end to end and **confirm the SMS arrives on a real
  handset** — this is the one thing no automated test can prove
- Sign in at `/admin/login`, publish something, confirm it appears publicly
- Confirm the floating WhatsApp button opens a chat with the right number
- Check the session cookie has `Secure`, `HttpOnly`, `SameSite=Lax`

---

## 8. Backups

```bash
sudo cp deploy/backup.sh.example /usr/local/bin/veerhanuman-backup.sh
sudo nano /usr/local/bin/veerhanuman-backup.sh     # set paths, off-site target
sudo chmod 750 /usr/local/bin/veerhanuman-backup.sh
sudo crontab -e
# 0 2 * * * /usr/local/bin/veerhanuman-backup.sh >> /var/log/veerhanuman-backup.log 2>&1
```

Backs up the database **and** `/var/lib/veerhanuman/storage`. Uploaded media
is on disk, not in the database, so a `pg_dump` alone is an incomplete backup.

### Restore

```bash
sudo systemctl stop veerhanuman-api
sudo -u postgres pg_restore --clean --if-exists -d veerhanuman /path/to/database.dump
sudo tar -xzf /path/to/media.tar.gz -C /var/lib/veerhanuman/
sudo chown -R veerhanuman:veerhanuman /var/lib/veerhanuman/storage
sudo systemctl start veerhanuman-api
```

**Rehearse this on a staging box before you need it.** An untested backup is
a hypothesis.

---

## 9. Deploying an update

```bash
cd /var/www/veerhanuman
sudo -u veerhanuman git rev-parse HEAD > /tmp/previous-release   # for rollback
sudo /usr/local/bin/veerhanuman-backup.sh                        # backup FIRST

sudo -u veerhanuman git pull
sudo -u veerhanuman npm ci
sudo -u veerhanuman npx prisma migrate deploy
sudo -u veerhanuman npm run build
sudo systemctl restart veerhanuman-api

curl -fsS https://<YOUR_DOMAIN>/api/ready
```

### Rollback

```bash
cd /var/www/veerhanuman
sudo -u veerhanuman git checkout "$(cat /tmp/previous-release)"
sudo -u veerhanuman npm ci && sudo -u veerhanuman npm run build
sudo systemctl restart veerhanuman-api
```

**Code rolls back; migrations do not.** Prisma has no automatic down
migrations, so an additive migration is safe to leave in place, and a
destructive one needs the database restoring from the pre-deploy backup.
Prefer additive migrations for exactly this reason.

---

## 10. SMS provider setup

```ini
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_FROM="+..."
```

or route through your own gateway:

```ini
SMS_PROVIDER=webhook
SMS_WEBHOOK_URL="https://your-relay.example.com/send"
SMS_WEBHOOK_TOKEN="..."
```

The webhook provider POSTs `{ "to": "+9198...", "body": "..." }` and treats
2xx as delivered, so a thin relay adapts it to MSG91, TextLocal, Gupshup or
similar.

### India (DLT) — required

Transactional SMS to Indian numbers needs DLT registration with the
operators:

1. Register the business entity on a DLT portal (Jio, Airtel, Vodafone Idea).
2. Register a **sender ID** (6 alphabetic characters).
3. Register the **OTP template**, matching the message body exactly.
4. Give the entity ID, sender ID and template ID to your provider.

The message in `otpMessage()` (`server/src/sms/index.ts`) is deliberately
short and link-free to fit these rules. **Change the template text there and
on the DLT portal together, or delivery silently fails.** Approval typically
takes several working days — start early.

---

## 11. Monitoring

Minimum viable, in rough priority order:

1. **Uptime check** on `https://<YOUR_DOMAIN>/api/ready` every 5 minutes,
   alerting on non-200. It covers the app and the database in one probe.
2. **Certificate expiry** — certbot renews automatically, but alert anyway.
3. **Disk space** — uploaded media and Postgres share the disk.
4. **Log review**: `journalctl -u veerhanuman-api -p err --since "24 hours ago"`.
5. **Backup success** — check `/var/log/veerhanuman-backup.log`; a silent
   backup failure is only discovered when you need the backup.

The application logs to stdout/stderr, captured by journald. Rotation is
handled by systemd (`journalctl --vacuum-time=30d`).
