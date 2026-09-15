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

export function clientForAccess(organizationId: string, clientId: string) {
  return db.client.findFirst({
    where: { id: clientId, organizationId, archivedAt: null },
    select: { id: true, name: true },
  })
}

export function guestFor(clientId: string, email: string) {
  return db.clientDriveGuest.findUnique({ where: { clientId_email: { clientId, email } } })
}

export function guestsFor(clientId: string) {
  return db.clientDriveGuest.findMany({ where: { clientId }, orderBy: { invitedAt: 'desc' } })
}

export function guestById(id: string) {
  return db.clientDriveGuest.findUnique({ where: { id } })
}

export function saveGuest(input: {
  clientId: string
  email: string
  invitedUserId: string | undefined
  permissionId: string | undefined
  role: string
}) {
  const { clientId, email, ...rest } = input
  const data = {
    invitedUserId: rest.invitedUserId ?? null,
    permissionId: rest.permissionId ?? null,
    role: rest.role,
  }
  return db.clientDriveGuest.upsert({
    where: { clientId_email: { clientId, email } },
    create: { clientId, email, ...data },
    // Re-sharing a revoked guest is a new grant, so the revocation is cleared.
    update: { ...data, revokedAt: null, invitedAt: new Date() },
  })
}

export function markGuestRevoked(id: string) {
  return db.clientDriveGuest.update({
    where: { id },
    data: { revokedAt: new Date(), permissionId: null },
  })
}

export async function organizationName(organizationId: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  return organization?.name ?? 'IHP Plus'
}
