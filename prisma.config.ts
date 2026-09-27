import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 CLI configuration.
 *
 * From v7 the connection URL lives here rather than in schema.prisma, which
 * keeps credentials out of a file that is committed. The schema declares the
 * provider only; the URL is read from the environment at CLI time.
 */
export default defineConfig({
  schema: 'server/prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: 'server/prisma/migrations',
    seed: 'tsx server/prisma/seed.ts',
  },
})
