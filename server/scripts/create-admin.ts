import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { prisma } from '../src/db.js'
import { hashPassword, passwordSchema } from '../src/auth/password.js'

/**
 * Creates the first super admin.
 *
 * There is no default account and no default password anywhere in this
 * project — a shipped credential is the single most common way a small
 * business site gets taken over. The account is created here, once, either
 * from BOOTSTRAP_ADMIN_* environment variables (useful in a deploy pipeline)
 * or interactively.
 *
 *   npm run admin:create
 */

async function main() {
  const existing = await prisma.adminUser.count({ where: { role: 'SUPER_ADMIN' } })

  let email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? ''
  let name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() ?? ''
  let password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? ''

  const fromEnv = Boolean(email && password)

  if (!fromEnv) {
    if (!stdin.isTTY) {
      console.error(
        'No TTY available and BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD are not set.\n' +
          'Set those in .env, or run this command in an interactive terminal.',
      )
      process.exit(1)
    }
    const rl = createInterface({ input: stdin, output: stdout })
    email = (await rl.question('Admin email: ')).trim().toLowerCase()
    name = (await rl.question('Full name: ')).trim()
    password = await rl.question('Password (min 12 characters): ')
    await rl.close()
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('A valid email address is required.')
    process.exit(1)
  }
  if (!name) name = email.split('@')[0]

  const check = passwordSchema.safeParse(password)
  if (!check.success) {
    console.error(`Password rejected: ${check.error.issues.map((i) => i.message).join(' ')}`)
    process.exit(1)
  }

  const duplicate = await prisma.adminUser.findUnique({ where: { email } })
  if (duplicate) {
    console.error(`An account already exists for ${email}.`)
    console.error('Use the admin panel to reset its password, or choose a different address.')
    process.exit(1)
  }

  const user = await prisma.adminUser.create({
    data: {
      email,
      name,
      role: 'SUPER_ADMIN',
      passwordHash: await hashPassword(password),
      // Prompt a change when the password arrived via environment variables,
      // since those tend to linger in shell history and deploy logs.
      mustResetPw: fromEnv,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action: 'ADMIN_USER_CREATED',
      entityType: 'AdminUser',
      entityId: user.id,
      summary: `Bootstrapped super admin ${user.email}`,
    },
  })

  console.log(`\nSuper admin created: ${user.email}`)
  if (existing > 0) console.log(`(${existing} super admin account(s) already existed.)`)
  if (fromEnv) {
    console.log('\nNow remove BOOTSTRAP_ADMIN_* from .env — they are no longer needed.')
  }
  console.log('Sign in at /admin/login\n')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
