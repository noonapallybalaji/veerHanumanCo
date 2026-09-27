import { env, isProduction } from '../env.js'

/**
 * SMS delivery.
 *
 * The provider is chosen by SMS_PROVIDER. The critical rule, enforced here
 * rather than left to callers: if no provider is configured, sending FAILS.
 * It never silently succeeds, because a silent success would let an enquiry
 * through without the visitor ever receiving a code — exactly the hole the
 * OTP requirement exists to close.
 *
 * Adding a provider means adding one case to `send` below; nothing else in
 * the codebase knows which provider is in use.
 */

export type SmsResult =
  | { ok: true; providerId?: string }
  | { ok: false; reason: string; retryable: boolean }

export interface SmsMessage {
  /** E.164 destination. */
  to: string
  body: string
}

/**
 * The active provider, read at call time.
 *
 * The value is validated by zod at boot (and `console` is refused in
 * production there), but it is re-read here rather than captured once. That
 * keeps the "no provider means no enquiries" path exercisable by tests
 * without adding a test-only hook to the send path, and costs nothing in
 * production, where nothing mutates process.env.
 */
function currentProvider(): (typeof env)['SMS_PROVIDER'] {
  const raw = process.env.SMS_PROVIDER
  const allowed = ['none', 'console', 'twilio', 'webhook'] as const
  return (allowed as readonly string[]).includes(raw ?? '')
    ? (raw as (typeof env)['SMS_PROVIDER'])
    : env.SMS_PROVIDER
}

/** True when a provider is configured well enough to attempt delivery. */
export function smsConfigured(): boolean {
  switch (currentProvider()) {
    case 'twilio':
      return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM)
    case 'webhook':
      return Boolean(env.SMS_WEBHOOK_URL)
    case 'console':
      // A developer aid only. Refused in production by env validation.
      return !isProduction
    case 'none':
    default:
      return false
  }
}

export function smsProviderName(): string {
  return currentProvider()
}

export async function sendSms(message: SmsMessage): Promise<SmsResult> {
  if (!smsConfigured()) {
    return {
      ok: false,
      reason: 'SMS is not configured on the server.',
      retryable: false,
    }
  }

  switch (currentProvider()) {
    case 'console':
      return sendViaConsole(message)
    case 'twilio':
      return sendViaTwilio(message)
    case 'webhook':
      return sendViaWebhook(message)
    default:
      return { ok: false, reason: 'Unknown SMS provider.', retryable: false }
  }
}

/**
 * Development only. Prints the message to the server log so the flow can be
 * exercised without a paid account. `env.ts` refuses this provider when
 * NODE_ENV=production, so it cannot reach real users.
 */
function sendViaConsole(message: SmsMessage): SmsResult {
  console.log(
    `\n[sms:console] ------------------------------------------\n` +
      `  to:   ${message.to}\n` +
      `  body: ${message.body}\n` +
      `-----------------------------------------------------\n`,
  )
  return { ok: true, providerId: 'console' }
}

/** Twilio REST API over fetch — no SDK, so nothing extra to keep patched. */
async function sendViaTwilio(message: SmsMessage): Promise<SmsResult> {
  const sid = env.TWILIO_ACCOUNT_SID!
  const token = env.TWILIO_AUTH_TOKEN!

  const body = new URLSearchParams({
    To: message.to,
    From: env.TWILIO_FROM!,
    Body: message.body,
  })

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      },
    )

    if (!response.ok) {
      // Log the provider's reason server-side; never return it to a client,
      // since it can disclose account and routing details.
      const detail = await response.text().catch(() => '')
      console.error(`[sms:twilio] ${response.status} ${detail.slice(0, 400)}`)
      return {
        ok: false,
        reason: `Twilio rejected the message (${response.status}).`,
        retryable: response.status >= 500 || response.status === 429,
      }
    }

    const payload = (await response.json()) as { sid?: string }
    return { ok: true, providerId: payload.sid }
  } catch (error) {
    console.error('[sms:twilio] request failed:', (error as Error).message)
    return { ok: false, reason: 'Could not reach the SMS provider.', retryable: true }
  }
}

/**
 * Generic JSON webhook, for Indian gateways (MSG91, TextLocal, Gupshup) or
 * an internal relay. POSTs { to, body } and treats 2xx as delivered.
 */
async function sendViaWebhook(message: SmsMessage): Promise<SmsResult> {
  try {
    const response = await fetch(env.SMS_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.SMS_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${env.SMS_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ to: message.to, body: message.body }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      console.error(`[sms:webhook] ${response.status}`)
      return {
        ok: false,
        reason: `SMS gateway rejected the message (${response.status}).`,
        retryable: response.status >= 500 || response.status === 429,
      }
    }
    return { ok: true }
  } catch (error) {
    console.error('[sms:webhook] request failed:', (error as Error).message)
    return { ok: false, reason: 'Could not reach the SMS gateway.', retryable: true }
  }
}

export function otpMessage(code: string, companyName: string): string {
  // Kept short and free of links: Indian DLT templates are strict, and a
  // link in an OTP message trains people to click links in OTP messages.
  return `${code} is your verification code for ${companyName}. It expires in ${Math.round(
    env.OTP_TTL_SECONDS / 60,
  )} minutes. Do not share it with anyone.`
}
