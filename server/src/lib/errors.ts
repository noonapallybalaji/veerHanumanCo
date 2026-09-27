import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { isProduction } from '../env.js'

/**
 * One error shape for the whole API:
 *   { error: { code, message, details? } }
 *
 * Messages are written to be safe to show a user. Internal details (stack
 * traces, driver errors) are logged server-side and never sent to a client
 * in production, because they leak schema and file paths.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'BAD_REQUEST', message, details)
  }
  static unauthorized(message = 'Authentication required.') {
    return new ApiError(401, 'UNAUTHORIZED', message)
  }
  static forbidden(message = 'You do not have permission to do that.') {
    return new ApiError(403, 'FORBIDDEN', message)
  }
  static notFound(message = 'Not found.') {
    return new ApiError(404, 'NOT_FOUND', message)
  }
  static conflict(message: string, details?: unknown) {
    return new ApiError(409, 'CONFLICT', message, details)
  }
  static unprocessable(message: string, details?: unknown) {
    return new ApiError(422, 'UNPROCESSABLE', message, details)
  }
  static tooManyRequests(message = 'Too many requests. Please try again shortly.') {
    return new ApiError(429, 'TOO_MANY_REQUESTS', message)
  }
}

/** Wraps an async handler so rejections reach the error middleware. */
export function asyncHandler<
  H extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
>(handler: H) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next)
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Some fields need attention.',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    })
  }

  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    })
  }

  // Prisma unique-constraint violation -> a readable conflict.
  const prismaCode = (error as { code?: string })?.code
  if (prismaCode === 'P2002') {
    const target = (error as { meta?: { target?: string[] } }).meta?.target
    const field = Array.isArray(target) ? target.join(', ') : 'value'
    return res.status(409).json({
      error: { code: 'CONFLICT', message: `That ${field} is already in use.` },
    })
  }
  if (prismaCode === 'P2025') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } })
  }
  if (prismaCode === 'P2003') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'That item is still referenced by other records.',
      },
    })
  }

  console.error('[api] unhandled error:', error)
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'Something went wrong. Please try again.',
      // Only in non-production, and only the message — never the stack.
      details: isProduction ? undefined : (error as Error)?.message,
    },
  })
}
