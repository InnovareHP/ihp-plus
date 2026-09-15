import { db } from '@ihp/db'
import type { MirrorState } from './schema'

export function subscriptionForDrive(driveId: string) {
  return db.driveSubscription.findUnique({ where: { driveId } })
}

export function subscriptionByGraphId(subscriptionId: string) {
  return db.driveSubscription.findFirst({ where: { subscriptionId } })
}

export function saveSweep(driveId: string, deltaLink: string | undefined) {
  return db.driveSubscription.update({
    where: { driveId },
    data: { deltaLink: deltaLink ?? null, lastSweptAt: new Date(), lastError: null },
  })
}

export function saveSweepError(driveId: string, message: string) {
  return db.driveSubscription.update({
    where: { driveId },
    data: { lastError: message.slice(0, 500), lastSweptAt: new Date() },
  })
}

/**
 * The folder name staff typed in Explorer is the only link to a client, so it is matched
 * case-insensitively and an archived client is ignored rather than silently shared with.
 */
export function clientByFolderName(organizationId: string, folderName: string) {
  return db.client.findFirst({
    where: { organizationId, archivedAt: null, name: { equals: folderName, mode: 'insensitive' } },
    select: { id: true, name: true },
  })
}

export function clientDriveFolder(clientId: string) {
  return db.clientDriveFolder.findUnique({ where: { clientId } })
}

export function saveClientDriveFolder(input: {
  organizationId: string
  clientId: string
  driveId: string
  itemId: string
  webUrl: string | undefined
}) {
  const { clientId, ...rest } = input
  return db.clientDriveFolder.upsert({
    where: { clientId },
    create: { clientId, ...rest, webUrl: rest.webUrl ?? null },
    update: { itemId: rest.itemId, webUrl: rest.webUrl ?? null },
  })
}

export function mirrorFor(sourceDriveId: string, sourceItemId: string) {
  return db.driveMirror.findUnique({
    where: { sourceDriveId_sourceItemId: { sourceDriveId, sourceItemId } },
  })
}

export function saveMirror(input: {
  organizationId: string
  clientId: string
  sourceDriveId: string
  sourceItemId: string
  sourceEtag: string | undefined
  sourcePath: string
  targetDriveId: string
  targetItemId: string | undefined
  state: MirrorState
  lastError?: string | undefined
}) {
  const { sourceDriveId, sourceItemId, lastError, ...rest } = input
  const common = {
    ...rest,
    sourceEtag: rest.sourceEtag ?? null,
    targetItemId: rest.targetItemId ?? null,
    lastError: lastError?.slice(0, 500) ?? null,
    syncedAt: rest.state === 'synced' ? new Date() : null,
    removedAt: rest.state === 'removed' ? new Date() : null,
  }

  return db.driveMirror.upsert({
    where: { sourceDriveId_sourceItemId: { sourceDriveId, sourceItemId } },
    create: { sourceDriveId, sourceItemId, ...common },
    update: { ...common, attempts: { increment: rest.state === 'failed' ? 1 : 0 } },
  })
}

export function markMirrorRemoved(id: string) {
  return db.driveMirror.update({
    where: { id },
    data: { state: 'removed', removedAt: new Date(), targetItemId: null },
  })
}
