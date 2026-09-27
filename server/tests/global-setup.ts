import { execSync } from 'node:child_process'
import 'dotenv/config'

/**
 * Prepares the test database once per run.
 *
 * Uses `migrate deploy`, not `migrate reset`. Deploy is non-destructive: it
 * creates the schema on a fresh database and applies any new migrations to
 * an existing one, while still proving the migrations actually apply. Row
 * cleanup is the suites' job — each calls resetTables() and sets its own
 * fixtures, so a clean schema is all that is needed here.
 *
 * (Prisma 7 also guards `migrate reset` behind an explicit-consent prompt
 * when it detects an AI agent, which is the right default for a command
 * that drops every table.)
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set — see .env.example.')
  }
  if (!/_test(\?|$)/.test(url.split('/').pop() ?? '')) {
    throw new Error(`Refusing to touch "${url}": the database name must end in "_test".`)
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: url },
  })
}
