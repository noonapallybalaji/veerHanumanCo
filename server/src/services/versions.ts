import { prisma } from '../db.js'
import { stringifyJson } from '../lib/json.js'

/**
 * Content version history.
 *
 * A snapshot is taken whenever an entity is published and before a
 * destructive change, so an editor can compare against, and restore, a
 * previous state. Restoring writes a new version rather than deleting
 * history, so the trail is append-only.
 */
export async function snapshot(
  entityType: string,
  entityId: string,
  data: unknown,
  actorId?: string | null,
  note?: string,
) {
  try {
    const latest = await prisma.contentVersion.findFirst({
      where: { entityType, entityId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    await prisma.contentVersion.create({
      data: {
        entityType,
        entityId,
        version: (latest?.version ?? 0) + 1,
        snapshot: stringifyJson(data),
        note: note ?? null,
        createdById: actorId ?? null,
      },
    })
  } catch (error) {
    console.error('[versions] failed to snapshot:', (error as Error).message)
  }
}

export async function listVersions(entityType: string, entityId: string) {
  return prisma.contentVersion.findMany({
    where: { entityType, entityId },
    orderBy: { version: 'desc' },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
    take: 50,
  })
}

export async function getVersion(entityType: string, entityId: string, version: number) {
  return prisma.contentVersion.findUnique({
    where: { entityType_entityId_version: { entityType, entityId, version } },
  })
}
