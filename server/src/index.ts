import { createApp } from './app.js'
import { env, isProduction } from './env.js'
import { prisma } from './db.js'
import { purgeExpiredSessions } from './auth/session.js'
import { purgeExpiredOtps } from './auth/otp.js'
import { purgeExpiredCustomerSessions } from './auth/customer.js'
import { enforceStartupChecks } from './startup-checks.js'
import { smsProviderName } from './sms/index.js'

// Refuse to start on unsafe production configuration, before anything binds
// a port. See server/src/startup-checks.ts.
enforceStartupChecks()

const app = createApp()

const server = app.listen(env.PORT, () => {
  console.log(`[api] listening on port ${env.PORT} (${env.NODE_ENV})`)
  console.log(`[api] allowed origins: ${env.CORS_ORIGINS.join(', ')}`)
  console.log(`[api] sms provider: ${smsProviderName()}`)
})

/**
 * Hourly housekeeping for the three tables that would otherwise grow without
 * bound. Each is independent, so one failure does not stop the others.
 */
const cleanup = setInterval(
  () => {
    void purgeExpiredSessions().catch((error) =>
      console.error('[api] admin session cleanup failed:', error.message),
    )
    void purgeExpiredCustomerSessions().catch((error) =>
      console.error('[api] visitor session cleanup failed:', error.message),
    )
    void purgeExpiredOtps().catch((error) =>
      console.error('[api] otp cleanup failed:', error.message),
    )
  },
  60 * 60 * 1000,
)
cleanup.unref()

/**
 * Graceful shutdown: stop accepting connections, let in-flight requests
 * finish, then close the pool. A hard exit mid-request would drop an
 * enquiry a customer believed was submitted.
 */
let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[api] ${signal} received, shutting down`)
  clearInterval(cleanup)

  // Force-exit if connections refuse to drain, so the supervisor can restart.
  const forceExit = setTimeout(() => {
    console.error('[api] shutdown timed out after 10s, exiting')
    process.exit(1)
  }, 10_000)
  forceExit.unref()

  await new Promise<void>((resolve) => server.close(() => resolve()))
  await prisma.$disconnect().catch(() => undefined)
  clearTimeout(forceExit)
  process.exit(0)
}

/*
 * A crash with an open HTTP server can leave the process wedged, serving
 * nothing while the port stays bound. Log and exit so the supervisor
 * restarts cleanly.
 */
process.on('uncaughtException', (error) => {
  console.error('[api] uncaught exception:', error)
  void shutdown('uncaughtException').finally(() => process.exit(1))
})
process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandled rejection:', reason)
  if (isProduction) void shutdown('unhandledRejection').finally(() => process.exit(1))
})

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
