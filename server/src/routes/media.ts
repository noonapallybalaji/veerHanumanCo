import { param } from '../lib/util.js'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import sharp, { type Metadata } from 'sharp'
import { z } from 'zod'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { ApiError, asyncHandler } from '../lib/errors.js'
import { requirePermission } from '../auth/middleware.js'
import { recordAudit } from '../services/audit.js'

export const mediaRouter = Router()
export const mediaAdminRouter = Router()

/**
 * Media storage.
 *
 * Security decisions worth spelling out:
 *  - Files are written to a directory OUTSIDE the web root and served back
 *    through the controlled GET route below. Nothing in the upload path is
 *    reachable as a static file, so a file that somehow lands there cannot
 *    be executed or served with an attacker-chosen content type.
 *  - The declared mime type and the file extension are both ignored for
 *    security decisions. The real format is detected from the file's magic
 *    bytes, and images are re-encoded with sharp, which discards any
 *    embedded payload (polyglot files, EXIF-hidden scripts).
 *  - The stored filename is random. A caller cannot choose a path, so
 *    traversal (`../../`) is impossible by construction.
 *  - Responses set Content-Disposition and a restrictive CSP so a document
 *    cannot execute in the site's origin.
 */

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const ALLOWED_DOCUMENT_TYPES = new Map<string, string>([
  ['application/pdf', 'pdf'],
])

const storageRoot = path.resolve(process.cwd(), env.MEDIA_LOCAL_DIR)

async function ensureStorage() {
  if (!existsSync(storageRoot)) await mkdir(storageRoot, { recursive: true })
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(env.MEDIA_MAX_IMAGE_MB, env.MEDIA_MAX_DOCUMENT_MB) * 1024 * 1024,
    files: 1,
  },
})

/** PDFs start with %PDF-. Checked directly rather than trusting the header. */
function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('latin1') === '%PDF-'
}

mediaAdminRouter.post(
  '/upload',
  requirePermission('media:write'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Choose a file to upload.')
    await ensureStorage()

    const kind = req.body?.kind === 'DOCUMENT' ? 'DOCUMENT' : 'IMAGE'
    const alt = typeof req.body?.alt === 'string' ? req.body.alt.slice(0, 200) : null
    const buffer = req.file.buffer
    const checksum = createHash('sha256').update(buffer).digest('hex')

    let storageKey: string
    let mimeType: string
    let size: number
    let width: number | null = null
    let height: number | null = null

    if (kind === 'IMAGE') {
      const maxBytes = env.MEDIA_MAX_IMAGE_MB * 1024 * 1024
      if (buffer.length > maxBytes) {
        throw ApiError.badRequest(`Images must be under ${env.MEDIA_MAX_IMAGE_MB} MB.`)
      }

      // Decoding with sharp both validates that this really is an image and
      // tells us the true format — the client's mime type is not trusted.
      let metadata: Metadata
      try {
        metadata = await sharp(buffer).metadata()
      } catch {
        throw ApiError.badRequest('That file is not a readable image.')
      }

      const detected = metadata.format ? `image/${metadata.format}` : ''
      if (!ALLOWED_IMAGE_TYPES.has(detected)) {
        throw ApiError.badRequest('Upload a JPG, PNG, WebP or AVIF image.')
      }

      // Re-encode to WebP: normalises the format, strips metadata (including
      // GPS EXIF) and any smuggled payload, and shrinks oversized photos so
      // the public site stays quick on mobile data.
      const output = await sharp(buffer)
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true })

      storageKey = `${Date.now()}-${randomBytes(12).toString('hex')}.webp`
      mimeType = 'image/webp'
      size = output.data.length
      width = output.info.width
      height = output.info.height

      await writeFile(path.join(storageRoot, storageKey), output.data)
    } else {
      const maxBytes = env.MEDIA_MAX_DOCUMENT_MB * 1024 * 1024
      if (buffer.length > maxBytes) {
        throw ApiError.badRequest(`Documents must be under ${env.MEDIA_MAX_DOCUMENT_MB} MB.`)
      }
      if (!isPdf(buffer) || !ALLOWED_DOCUMENT_TYPES.has(req.file.mimetype)) {
        throw ApiError.badRequest('Only PDF documents can be uploaded.')
      }

      storageKey = `${Date.now()}-${randomBytes(12).toString('hex')}.pdf`
      mimeType = 'application/pdf'
      size = buffer.length
      await writeFile(path.join(storageRoot, storageKey), buffer)
    }

    const media = await prisma.media.create({
      data: {
        kind,
        storageKey,
        // Kept for display only — never used to build a path.
        filename: path.basename(req.file.originalname).slice(0, 200),
        mimeType,
        size,
        width,
        height,
        checksum,
        alt,
        uploadedById: req.user!.id,
      },
    })

    await recordAudit(req, {
      action: 'MEDIA_UPLOADED',
      entityType: 'Media',
      entityId: media.id,
      summary: `Uploaded ${kind.toLowerCase()} "${media.filename}"`,
    })

    res.status(201).json({
      media: {
        id: media.id,
        url: `/api/media/${media.id}`,
        kind: media.kind,
        filename: media.filename,
        width: media.width,
        height: media.height,
        size: media.size,
        alt: media.alt,
      },
    })
  }),
)

mediaAdminRouter.get(
  '/',
  requirePermission('content:read'),
  asyncHandler(async (req, res) => {
    const kind = req.query.kind === 'DOCUMENT' ? 'DOCUMENT' : 'IMAGE'
    const media = await prisma.media.findMany({
      where: { kind },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    res.json({
      media: media.map((item) => ({
        id: item.id,
        url: `/api/media/${item.id}`,
        kind: item.kind,
        filename: item.filename,
        width: item.width,
        height: item.height,
        size: item.size,
        alt: item.alt,
        createdAt: item.createdAt,
      })),
    })
  }),
)

mediaAdminRouter.put(
  '/:id',
  requirePermission('media:write'),
  asyncHandler(async (req, res) => {
    const schema = z.object({ alt: z.string().trim().max(200) })
    const input = schema.parse(req.body)
    const media = await prisma.media.update({
      where: { id: param(req, 'id') },
      data: { alt: input.alt },
    })
    res.json({ media: { id: media.id, alt: media.alt } })
  }),
)

/**
 * Public read route. Media is only reachable through here, which is what
 * makes the "outside the web root" storage meaningful.
 */
mediaRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const media = await prisma.media.findUnique({ where: { id: param(req, 'id') } })
    if (!media) throw ApiError.notFound('File not found.')

    // storageKey is generated server-side and never user-controlled, but the
    // containment check costs nothing and documents the intent.
    const filePath = path.resolve(storageRoot, media.storageKey)
    if (!filePath.startsWith(storageRoot + path.sep)) throw ApiError.notFound('File not found.')

    let data: Buffer
    try {
      data = await readFile(filePath)
    } catch {
      throw ApiError.notFound('File not found.')
    }

    res.setHeader('Content-Type', media.mimeType)
    res.setHeader('Content-Length', String(data.length))
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    // Neutralises any active content, whatever the file turns out to contain.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    res.setHeader(
      'Content-Disposition',
      `${media.kind === 'DOCUMENT' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(media.filename)}"`,
    )
    res.send(data)
  }),
)
