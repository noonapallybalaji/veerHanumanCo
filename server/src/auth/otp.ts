import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { hashIp } from '../lib/util.js'
import { otpMessage, sendSms, smsConfigured } from '../sms/index.js'

/**
 * One-time passcodes.
 *
 * Design notes worth keeping:
 *  - The code is never stored. Only an HMAC keyed with AUTH_SECRET is, so a
 *    database dump cannot be replayed, and rotating AUTH_SECRET invalidates
 *    every outstanding challenge.
 *  - Comparison is constant-time, so response timing does not leak how much
 *    of a guess was right.
 *  - A challenge is consumed on success and burned when attempts run out, so
 *    one code can never be used twice.
 *  - Limits are enforced per phone number, not per IP, because the abuse
 *    that matters (SMS-pumping someone else's number, or brute-forcing a
 *    code) is cheap to spread across addresses. An IP rate limit sits in
 *    front of this as well.
 */

export const OTP_PURPOSES = ['WELCOME', 'ENQUIRY', 'LOGIN'] as const
export type OtpPurpose = (typeof OTP_PURPOSES)[number]

function hashCode(code: string, phone: string): string {
  // The phone is mixed in so a hash cannot be moved between numbers.
  return createHmac('sha256', env.AUTH_SECRET).update(`${phone}:${code}`).digest('hex')
}

function generateCode(): string {
  const max = 10 ** env.OTP_LENGTH
  // randomInt is CSPRNG-backed; Math.random would be guessable.
  return String(randomInt(0, max)).padStart(env.OTP_LENGTH, '0')
}

/**
 * Normalises an Indian mobile number to E.164.
 * Returns null when it is not a number we can send to, so callers never
 * build a challenge for an address that cannot receive it.
 */
export function normalisePhone(input: string): string | null {
  const digits = (input ?? '').replace(/[^\d]/g, '')
  if (!digits) return null

  // 10-digit local, or 91-prefixed, or 0-prefixed local.
  let local = digits
  if (digits.length === 12 && digits.startsWith('91')) local = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) local = digits.slice(1)
  else if (digits.length === 13 && digits.startsWith('091')) local = digits.slice(3)

  if (!/^[6-9]\d{9}$/.test(local)) return null
  return `+91${local}`
}

export type RequestOtpResult =
  | { ok: true; expiresInSeconds: number; resendInSeconds: number }
  | { ok: false; code: 'SMS_UNAVAILABLE' | 'COOLDOWN' | 'THROTTLED' | 'SEND_FAILED'; message: string; retryInSeconds?: number }

export async function requestOtp(
  req: Request,
  phone: string,
  purpose: OtpPurpose,
  companyName: string,
): Promise<RequestOtpResult> {
  // Fail closed: without a configured provider there is no way to deliver a
  // code, so the caller must not be allowed to proceed unverified.
  if (!smsConfigured()) {
    return {
      ok: false,
      code: 'SMS_UNAVAILABLE',
      message:
        'Phone verification is temporarily unavailable, so we cannot accept the form right now. Please call or message us instead.',
    }
  }

  const now = new Date()
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const recent = await prisma.otpChallenge.findMany({
    where: { phone, createdAt: { gte: hourAgo } },
    orderBy: { createdAt: 'desc' },
  })

  const sendsThisHour = recent.reduce((total, row) => total + row.sendCount, 0)
  if (sendsThisHour >= env.OTP_MAX_SENDS_PER_HOUR) {
    return {
      ok: false,
      code: 'THROTTLED',
      message:
        'Too many verification codes have been sent to this number recently. Please try again later.',
    }
  }

  const live = recent.find((row) => !row.consumedAt && row.expiresAt > now)
  if (live) {
    const since = (now.getTime() - live.lastSentAt.getTime()) / 1000
    if (since < env.OTP_RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        code: 'COOLDOWN',
        message: 'A code was just sent. Please wait a moment before asking for another.',
        retryInSeconds: Math.ceil(env.OTP_RESEND_COOLDOWN_SECONDS - since),
      }
    }
  }

  const code = generateCode()
  const expiresAt = new Date(now.getTime() + env.OTP_TTL_SECONDS * 1000)

  // Supersede any outstanding challenge so only the newest code works.
  await prisma.otpChallenge.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: now },
  })

  const challenge = await prisma.otpChallenge.create({
    data: {
      phone,
      codeHash: hashCode(code, phone),
      purpose,
      expiresAt,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      lastSentAt: now,
      sendCount: 1,
      ipHash: hashIp(req),
    },
  })

  const delivery = await sendSms({ to: phone, body: otpMessage(code, companyName) })

  if (!delivery.ok) {
    // Burn the challenge: nobody received this code, so leaving it live
    // would only widen the window for a lucky guess.
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    })
    return {
      ok: false,
      code: 'SEND_FAILED',
      message: delivery.retryable
        ? 'We could not send the code just now. Please try again in a moment.'
        : 'We could not send a verification code to that number.',
    }
  }

  return {
    ok: true,
    expiresInSeconds: env.OTP_TTL_SECONDS,
    resendInSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
  }
}

export type VerifyOtpResult =
  | { ok: true }
  | {
      ok: false
      code: 'NO_CHALLENGE' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'INVALID'
      message: string
      attemptsRemaining?: number
    }

export async function verifyOtp(phone: string, submitted: string): Promise<VerifyOtpResult> {
  const now = new Date()

  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (!challenge) {
    return {
      ok: false,
      code: 'NO_CHALLENGE',
      message: 'That code is no longer valid. Please request a new one.',
    }
  }

  if (challenge.expiresAt <= now) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    })
    return { ok: false, code: 'EXPIRED', message: 'That code has expired. Please request a new one.' }
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    })
    return {
      ok: false,
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Too many incorrect attempts. Please request a new code.',
    }
  }

  const expected = Buffer.from(challenge.codeHash, 'hex')
  const actual = Buffer.from(hashCode((submitted ?? '').trim(), phone), 'hex')
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual)

  if (!matches) {
    const updated = await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })
    const remaining = Math.max(0, updated.maxAttempts - updated.attempts)

    if (remaining === 0) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } })
      return {
        ok: false,
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many incorrect attempts. Please request a new code.',
      }
    }

    return {
      ok: false,
      code: 'INVALID',
      message: `That code is not correct. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      attemptsRemaining: remaining,
    }
  }

  // Single use.
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } })
  return { ok: true }
}

/** Housekeeping so the challenge table does not grow without bound. */
export async function purgeExpiredOtps() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await prisma.otpChallenge.deleteMany({ where: { createdAt: { lt: cutoff } } })
}
