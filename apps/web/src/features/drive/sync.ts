import {
  copyItem,
  deleteItem,
  deltaSweep,
  ensureFolder,
  GraphError,
  requireClientDriveId,
  type DriveItem,
} from '@ihp/graph'
import { track } from '@/lib/analytics'
import { driveEvents } from './events'
import { EMPTY_OUTCOME, type SyncOutcome } from './schema'
import {
  clientByFolderName,
  clientDriveFolder,
  markMirrorRemoved,
  mirrorFor,
  saveClientDriveFolder,
  saveMirror,
  saveSweep,
  saveSweepError,
  subscriptionForDrive,
} from './service'
import { isFolder, isRemoved, mirrorTargetOf, parentSegmentsOf } from './utils/mirror-path'

interface SyncContext {
  organizationId: string
  sourceDriveId: string
  targetDriveId: string
  /** Folder ids already resolved this run, keyed by client id and path. */
  folders: Map<string, string>
}

async function clientRootFolder(context: SyncContext, clientId: string, clientName: string) {
  const cacheKey = `${clientId}:`
  const cached = context.folders.get(cacheKey)
  if (cached) return cached

  const known = await clientDriveFolder(clientId)
  if (known && known.driveId === context.targetDriveId) {
    context.folders.set(cacheKey, known.itemId)
    return known.itemId
  }

  const folder = await ensureFolder(context.targetDriveId, 'root', clientName)
  await saveClientDriveFolder({
    organizationId: context.organizationId,
    clientId,
    driveId: context.targetDriveId,
    itemId: folder.id,
    webUrl: folder.webUrl,
  })
  context.folders.set(cacheKey, folder.id)
  return folder.id
}

/** Walks the folders an item sits under, creating the ones the client library does not have. */
async function ensureFolderPath(
  context: SyncContext,
  clientId: string,
  rootItemId: string,
  segments: string[],
) {
  let parentId = rootItemId
  let walked = ''

  for (const segment of segments) {
    walked = walked ? `${walked}/${segment}` : segment
    const cacheKey = `${clientId}:${walked}`
    const cached = context.folders.get(cacheKey)
    if (cached) {
      parentId = cached
      continue
    }

    const folder = await ensureFolder(context.targetDriveId, parentId, segment)
    context.folders.set(cacheKey, folder.id)
    parentId = folder.id
  }

  return parentId
}

/** A copy the client library no longer has a source for; a 404 means it is already gone. */
async function removeCopy(targetDriveId: string, targetItemId: string) {
  try {
    await deleteItem(targetDriveId, targetItemId)
  } catch (error) {
    if (!(error instanceof GraphError) || !error.isNotFound) throw error
  }
}

async function dropMirror(context: SyncContext, item: DriveItem) {
  const existing = await mirrorFor(context.sourceDriveId, item.id)
  if (!existing || existing.state === 'removed') return false

  if (existing.targetItemId) await removeCopy(context.targetDriveId, existing.targetItemId)
  await markMirrorRemoved(existing.id)
  return true
}

async function syncItem(context: SyncContext, item: DriveItem, outcome: SyncOutcome) {
  if (isRemoved(item)) {
    if (await dropMirror(context, item)) outcome.removed++
    else outcome.skipped++
    return
  }

  const target = mirrorTargetOf(item)
  if (!target) {
    // A file moved out of the Shared shelf is a revocation, not a no-op.
    if (await dropMirror(context, item)) outcome.removed++
    else outcome.skipped++
    return
  }

  const client = await clientByFolderName(context.organizationId, target.clientFolder)
  if (!client) {
    outcome.skipped++
    return
  }

  const rootItemId = await clientRootFolder(context, client.id, client.name)
  if (isFolder(item)) {
    const segments = target.relativePath.split('/').filter(Boolean)
    await ensureFolderPath(context, client.id, rootItemId, segments)
    outcome.skipped++
    return
  }

  const existing = await mirrorFor(context.sourceDriveId, item.id)
  if (existing?.state === 'synced' && existing.sourceEtag === item.eTag) {
    outcome.skipped++
    return
  }

  const record = {
    organizationId: context.organizationId,
    clientId: client.id,
    sourceDriveId: context.sourceDriveId,
    sourceItemId: item.id,
    sourceEtag: item.eTag,
    sourcePath: `${target.clientFolder}/${target.relativePath}`,
    targetDriveId: context.targetDriveId,
  }

  try {
    const parentItemId = await ensureFolderPath(
      context,
      client.id,
      rootItemId,
      parentSegmentsOf(target),
    )
    // Replaced rather than versioned: the internal library is the one place history lives.
    if (existing?.targetItemId) await removeCopy(context.targetDriveId, existing.targetItemId)

    const targetItemId = await copyItem(context.sourceDriveId, item.id, {
      driveId: context.targetDriveId,
      parentItemId,
      name: item.name,
    })

    await saveMirror({ ...record, targetItemId, state: 'synced' })
    if (existing) outcome.updated++
    else outcome.copied++
  } catch (error) {
    await saveMirror({
      ...record,
      targetItemId: existing?.targetItemId ?? undefined,
      state: 'failed',
      lastError: error instanceof Error ? error.message : 'Unknown error.',
    })
    outcome.failed++
  }
}

/**
 * Replays the drive's changes since the stored delta link and makes the client library match.
 * Safe to run twice: an unchanged eTag is skipped and every copy is keyed by its source item.
 */
export async function syncDrive(driveId: string): Promise<SyncOutcome> {
  const subscription = await subscriptionForDrive(driveId)
  if (!subscription) throw new Error(`No subscription is recorded for drive ${driveId}.`)

  const context: SyncContext = {
    organizationId: subscription.organizationId,
    sourceDriveId: driveId,
    targetDriveId: requireClientDriveId(),
    folders: new Map(),
  }
  const outcome = { ...EMPTY_OUTCOME }

  track(driveEvents.sweepStarted, { driveId })

  try {
    const sweep = await deltaSweep(driveId, subscription.deltaLink ?? undefined)
    for (const item of sweep.items) {
      await syncItem(context, item, outcome)
    }
    await saveSweep(driveId, sweep.deltaLink)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.'
    await saveSweepError(driveId, message)
    track(driveEvents.sweepFailed, { driveId, reason: message.slice(0, 120) })
    throw error
  }

  track(driveEvents.sweepFinished, { driveId, ...outcome })
  return outcome
}
