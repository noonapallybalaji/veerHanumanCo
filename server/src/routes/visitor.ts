import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { ApiError, asyncHandler } from '../lib/errors.js'
import { hashIp } from '../lib/util.js'
import { limitOf } from '../lib/rateLimit.js'
import {
  clearCustomerCookies,
  createCustomerSession,
  requireCustomerCsrf,
  revokeCustomerSession,
  upsertVerifiedCustomer,
} from '../auth/customer.js'
import { OTP_PURPOSES, normalisePhone, requestOtp, verifyOtp } from '../auth/otp.js'
import { smsConfigured } from '../sms/index.js'

/**
 * Visitor-facing authentication: OTP request/verify, welcome-modal leads,
 * session status and sign-out.
 *
 * Everything here is anonymous-accessible by necessity, so each endpoint is
 * rate limited by IP on top of the per-phone limits inside the OTP module.
 */
export const visitorRouter = Router()

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: limitOf(12),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many verification requests. Please wait a few minutes.',
    },
  },
})

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: limitOf(30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please wait a few minutes.' },
  },
})

const leadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: limitOf(10), legacyHeaders: false })

async function companyName(): Promise<string> {
  const profile = await prisma.companyProfile.findUnique({
    where: { id: 'singleton' },
    select: { companyName: true },
  })
  return profile?.companyName ?? 'Veer Hanuman Trading Co.'
}

/* ------------------------------------------------------------ Capability */

/**
 * Lets the UI tell a visitor up front whether verification is possible,
 * instead of letting them fill in a form that cannot be submitted.
 */
visitorRouter.get(
  '/capability',
  asyncHandler(async (_req, res) => {
    res.json({
      otpAvailable: smsConfigured(),
      otpLength: env.OTP_LENGTH,
      resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
      codeTtlSeconds: env.OTP_TTL_SECONDS,
    })
  }),
)

/* ------------------------------------------------------------------ OTP */

visitorRouter.post(
  '/otp/request',
  otpRequestLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      phone: z.string().trim().min(6).max(24),
      purpose: z.enum(OTP_PURPOSES).default('LOGIN'),
    })
    const input = schema.parse(req.body)

    const phone = normalisePhone(input.phone)
    if (!phone) {
      throw ApiError.badRequest('Enter a valid 10-digit Indian mobile number.')
    }

    const blocked = await prisma.customer.findUnique({
      where: { phone },
      select: { isBlocked: true },
    })
    if (blocked?.isBlocked) {
      // Same shape as a send failure: do not confirm the number is known.
      throw new ApiError(
        429,
        'THROTTLED',
        'We cannot send a verification code to that number. Please contact us directly.',
      )
    }

    const result = await requestOtp(req, phone, input.purpose, await companyName())

    if (!result.ok) {
      const status =
        result.code === 'SMS_UNAVAILABLE' ? 503 : result.code === 'SEND_FAILED' ? 502 : 429
      throw new ApiError(status, result.code, result.message, {
        retryInSeconds: result.retryInSeconds,
      })
    }

    res.json({
      sent: true,
      // Echoed back so the UI can show what the visitor typed, normalised.
      phone,
      expiresInSeconds: result.expiresInSeconds,
      resendInSeconds: result.resendInSeconds,
    })
  }),
)

visitorRouter.post(
  '/otp/verify',
  otpVerifyLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      phone: z.string().trim().min(6).max(24),
      code: z.string().trim().min(4).max(8),
      // Optional profile details captured alongside verification.
      name: z.string().trim().max(120).optional(),
      email: z.string().trim().max(200).optional(),
      company: z.string().trim().max(160).optional(),
      marketingConsent: z.boolean().optional(),
    })
    const input = schema.parse(req.body)

    const phone = normalisePhone(input.phone)
    if (!phone) throw ApiError.badRequest('Enter a valid 10-digit Indian mobile number.')

    const result = await verifyOtp(phone, input.code)
    if (!result.ok) {
      const status = result.code === 'TOO_MANY_ATTEMPTS' ? 429 : 400
      throw new ApiError(status, result.code, result.message, {
        attemptsRemaining: result.attemptsRemaining,
      })
    }

    /*
     * Verification IS the authentication step. The account is created or
     * found here and a session issued, so a verified visitor is logged in
     * without ever choosing a password.
     */
    const customer = await upsertVerifiedCustomer({
      phone,
      name: input.name,
      email: input.email,
      company: input.company,
      marketingConsent: input.marketingConsent,
    })

    const { csrf } = await createCustomerSession(req, res, customer.id)

    res.json({
      verified: true,
      csrfToken: csrf,
      customer: publicCustomer(customer),
    })
  }),
)

/* --------------------------------------------------------------- Session */

visitorRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.customer) return res.json({ customer: null })

    const customer = await prisma.customer.findUnique({ where: { id: req.customer.id } })
    if (!customer || customer.isBlocked) return res.json({ customer: null })

    res.json({
      customer: publicCustomer(customer),
      csrfToken: req.cookies?.vh_customer_csrf ?? null,
    })
  }),
)

visitorRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.customer) await revokeCustomerSession(req.customer.sessionId)
    clearCustomerCookies(res)
    res.json({ ok: true })
  }),
)

/* ------------------------------------------------------------------ Lead */

/**
 * Welcome-modal capture.
 *
 * Unlike an enquiry, this accepts an unverified submission: the modal is a
 * greeting, and a lead we cannot yet phone is still worth recording — marked
 * plainly as unverified so nobody mistakes it for a confirmed contact.
 */
visitorRouter.post(
  '/leads',
  leadLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().trim().min(2, 'Please enter your name.').max(120),
      phone: z.string().trim().min(6, 'Please enter your mobile number.').max(24),
      company: z.string().trim().max(160).optional().or(z.literal('')),
      email: z
        .string()
        .trim()
        .max(200)
        .refine(
          (value) => value === '' || z.string().email().safeParse(value).success,
          'Enter a valid email address.',
        )
        .optional()
        .or(z.literal('')),
      requirement: z.string().trim().max(2000).optional().or(z.literal('')),
      consent: z.literal(true, {
        message: 'Please accept the contact consent to continue.',
      }),
      marketingConsent: z.boolean().optional(),
      source: z.string().trim().max(60).optional(),
      // Honeypot, handled the same way as the other public forms.
      website: z.string().max(200).optional(),
    })
    const input = schema.parse(req.body)

    if (input.website) return res.status(202).json({ saved: true })

    const phone = normalisePhone(input.phone)
    if (!phone) throw ApiError.badRequest('Enter a valid 10-digit Indian mobile number.')

    /*
     * Trust only the server's own view of verification: the lead counts as
     * verified when this browser holds a live session for the SAME number,
     * never because the client said so.
     */
    const verified = Boolean(req.customer?.phoneVerifiedAt && req.customer.phone === phone)

    const lead = await prisma.lead.create({
      data: {
        name: input.name,
        phone,
        company: input.company || null,
        email: input.email || null,
        requirement: input.requirement || null,
        source: input.source?.trim() || 'welcome-modal',
        isPhoneVerified: verified,
        customerId: verified ? (req.customer?.id ?? null) : null,
        consentAccepted: true,
        marketingConsent: Boolean(input.marketingConsent),
        ipHash: hashIp(req),
      },
      select: { id: true, isPhoneVerified: true },
    })

    // Keep a verified customer's profile in step with what they just typed.
    if (verified && req.customer) {
      await prisma.customer
        .update({
          where: { id: req.customer.id },
          data: {
            name: input.name,
            email: input.email || undefined,
            company: input.company || undefined,
            marketingConsent: input.marketingConsent ? true : undefined,
          },
        })
        .catch(() => undefined)
    }

    res.status(201).json({ saved: true, verified: lead.isPhoneVerified })
  }),
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function publicCustomer(customer: any) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? '',
    company: customer.company ?? '',
    phoneVerified: Boolean(customer.phoneVerifiedAt),
    marketingConsent: customer.marketingConsent,
  }
}

export { requireCustomerCsrf }
