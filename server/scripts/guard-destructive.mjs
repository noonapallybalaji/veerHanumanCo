/**
 * Refuses to run a destructive Prisma command against anything that looks
 * like a production database.
 *
 * `prisma migrate reset` drops every table. It is a normal part of local
 * development and catastrophic anywhere else, and the only thing separating
 * the two is which DATABASE_URL happens to be exported in the shell. This
 * puts a deliberate barrier in that gap.
 *
 * Usage: node server/scripts/guard-destructive.mjs <command...>
 */
import 'dotenv/config'
import { spawnSync } from 'node:child_process'

const url = process.env.DATABASE_URL ?? ''
const command = process.argv.slice(2)

if (command.length === 0) {
  console.error('guard-destructive: no command given')
  process.exit(1)
}

function refuse(reason) {
  console.error('\n  REFUSED: this command would destroy data.\n')
  console.error(`  Reason: ${reason}`)
  console.error(`  Target: ${redact(url)}\n`)
  console.error('  If you genuinely want to reset a LOCAL database, run:')
  console.error('    ALLOW_DESTRUCTIVE=yes npm run db:reset\n')
  process.exit(1)
}

/** Never print credentials, even in a refusal message. */
function redact(value) {
  try {
    const parsed = new URL(value)
    parsed.password = '***'
    parsed.username = parsed.username ? '***' : ''
    return parsed.toString()
  } catch {
    return '(unparseable DATABASE_URL)'
  }
}

if (!url) refuse('DATABASE_URL is not set.')

if (process.env.NODE_ENV === 'production') {
  refuse('NODE_ENV is "production".')
}

let host = ''
let database = ''
try {
  const parsed = new URL(url)
  host = parsed.hostname
  database = parsed.pathname.replace(/^\//, '')
} catch {
  refuse('DATABASE_URL could not be parsed.')
}

const localHosts = ['localhost', '127.0.0.1', '::1', 'host.docker.internal', 'postgres', 'db']
if (!localHosts.includes(host)) {
  refuse(`the database host "${host}" is not local.`)
}

if (/prod|production|live/i.test(database)) {
  refuse(`the database name "${database}" looks like production.`)
}

if (process.env.ALLOW_DESTRUCTIVE !== 'yes') {
  refuse('ALLOW_DESTRUCTIVE=yes was not set. This is an explicit opt-in.')
}

console.log(`guard-destructive: target looks local (${host}/${database}) — proceeding.`)

const result = spawnSync(command[0], command.slice(1), { stdio: 'inherit', shell: true })
process.exit(result.status ?? 1)
