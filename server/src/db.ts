import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env, isProduction } from './env.js'

/**
 * Prisma client.
 *
 * Postgres in every environment — development, test and production — so
 * there is no dialect gap between what the tests exercise and what ships.
 * An earlier SQLite-in-dev setup would have shipped two real bugs:
 * SQLite-flavoured migrations that Postgres cannot apply, and `contains`
 * filters that are case-insensitive on SQLite but case-sensitive on
 * Postgres, which would have made admin search silently fail in production.
 *
 * Prisma 7 requires a driver adapter; this is the only file that knows
 * which driver is in use.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // Keep the pool small: this is a low-traffic B2B site, and a modest
    // ceiling avoids exhausting connection slots on small managed instances.
    max: isProduction ? 10 : 5,
  })

  return new PrismaClient({
    adapter,
    log: isProduction ? ['error'] : ['error', 'warn'],
  })
}

// Reused across hot reloads so `tsx watch` does not leak connections.
export const prisma = globalForPrisma.prisma ?? createClient()

if (!isProduction) globalForPrisma.prisma = prisma
