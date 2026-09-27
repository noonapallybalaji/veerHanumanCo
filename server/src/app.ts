import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env, isProduction } from './env.js'
import { prisma } from './db.js'
import { smsConfigured } from './sms/index.js'
import { asyncHandler, errorHandler, notFoundHandler } from './lib/errors.js'
import { loadUser, requireAuth, requireCsrf } from './auth/middleware.js'
import { loadCustomer } from './auth/customer.js'
import { authRouter } from './routes/auth.js'
import { visitorRouter } from './routes/visitor.js'
import { sitemapRouter } from './routes/sitemap.js'
import { publicRouter } from './routes/public.js'
import { mediaAdminRouter, mediaRouter } from './routes/media.js'
import { catalogueRouter } from './routes/admin/catalogue.js'
import { projectsRouter } from './routes/admin/projects.js'
import { reviewsRouter } from './routes/admin/reviews.js'
import { settingsRouter } from './routes/admin/settings.js'
import { enquiriesRouter } from './routes/admin/enquiries.js'
import { auditRouter, usersRouter } from './routes/admin/users.js'
import { dashboardRouter } from './routes/admin/dashboard.js'
import { leadsRouter } from './routes/admin/leads.js'

/**
 * Express app factory.
 *
 * Exported separately from the listener so tests can mount the same app
 * in-process with supertest, exercising the real middleware chain — auth,
 * CSRF and all — rather than a stubbed version of it.
 */
export function createApp() {
  const app = express()

  // Behind a reverse proxy in production, so X-Forwarded-For is meaningful
  // for rate limiting. Left off in development to avoid trusting a spoofable
  // header on a directly exposed port.
  if (isProduction) app.set('trust proxy', 1)

  app.disable('x-powered-by')

  app.use(
    helmet({
      // The API serves JSON and media, never HTML pages, so the frameguard
      // and CSP defaults are fine. crossOriginResourcePolicy is relaxed so
      // the SPA on another port can display media.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  )

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and server-to-server calls have no Origin header.
        if (!origin) return callback(null, true)
        if (env.CORS_ORIGINS.includes(origin)) return callback(null, true)
        callback(new Error('Origin not allowed by CORS'))
      },
      credentials: true,
        // Two CSRF headers: one per session kind, kept distinct so an admin
      // token can never be replayed as a visitor token.
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Customer-CSRF-Token'],
    }),
  )

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: false, limit: '1mb' }))
  app.use(cookieParser())

  // Broad backstop against traffic floods. Tight per-endpoint limits live on
  // the sensitive routes (sign-in, review and enquiry submission).
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: env.NODE_ENV === 'test' ? 100000 : 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  )

  /*
   * Served at the site root, not under /api, because that is where crawlers
   * look. The reverse proxy must route these two paths to the API rather
   * than to the static bundle — see "Deployment" in the README.
   */
  app.use('/', sitemapRouter)

  /*
   * Liveness: "is this process up?". Deliberately says nothing else — it is
   * reachable by anyone who can hit the port, so it discloses no version,
   * environment, dependency state or timing that would help an attacker
   * fingerprint the deployment.
   */
  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ ok: true })
  })

  /*
   * Readiness: "can this process actually serve requests?". Used by the
   * deploy script and uptime monitoring. It reports component status as
   * plain booleans — never connection strings, credentials, driver errors
   * or row counts.
   */
  app.get(
    '/api/ready',
    asyncHandler(async (_req, res) => {
      let database = false
      try {
        await prisma.$queryRaw`SELECT 1`
        database = true
      } catch (error) {
        // Logged server-side only; the response stays a bare boolean.
        console.error('[ready] database check failed:', (error as Error).message)
      }

      const sms = smsConfigured()
      // SMS being down does not make the site unservable — the catalogue
      // still works — but enquiries will be refused, so it is surfaced.
      const ready = database

      res.status(ready ? 200 : 503)
      res.set('Cache-Control', 'no-store')
      res.json({
        ready,
        checks: {
          database,
          // false here means every enquiry form is refused.
          smsConfigured: sms,
        },
      })
    }),
  )

  // Resolve both session kinds (if present) before anything that needs them.
  // They are independent: a request may carry an admin session, a visitor
  // session, both, or neither.
  app.use(loadUser)
  app.use(loadCustomer)

  app.use('/api/auth', authRouter)
  app.use('/api/visitor', visitorRouter)
  app.use('/api/public', publicRouter)
  app.use('/api/media', mediaRouter)

  /**
   * Everything below requires a signed-in admin AND a matching CSRF token on
   * writes. Applied at the mount point rather than per route, so a new
   * endpoint cannot be added without protection by accident.
   */
  const admin = express.Router()
  admin.use(requireAuth, requireCsrf)
  admin.use('/dashboard', dashboardRouter)
  admin.use('/catalogue', catalogueRouter)
  admin.use('/projects', projectsRouter)
  admin.use('/reviews', reviewsRouter)
  admin.use('/settings', settingsRouter)
  admin.use('/enquiries', enquiriesRouter)
  admin.use('/leads', leadsRouter)
  admin.use('/users', usersRouter)
  admin.use('/audit', auditRouter)
  admin.use('/media', mediaAdminRouter)
  app.use('/api/admin', admin)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
