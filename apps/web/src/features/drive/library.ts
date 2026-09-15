import {
  deleteItem,
  downloadUrl,
  ensureFolder,
  requireInternalDriveId,
  rootItem,
  uploadFile,
} from '@ihp/graph'
import { safeLibraryName } from './utils/library-name'

/** Bluebook sits outside Clients/, so nothing filed here is ever mirrored to a client. */
export const BLUEBOOK_ROOT = 'Bluebook'

async function ensureInternalFolder(segments: string[]) {
  const driveId = requireInternalDriveId()
  let parentItemId = (await rootItem(driveId)).id

  for (const segment of segments) {
    const folder = await ensureFolder(driveId, parentItemId, safeLibraryName(segment, 'folder'))
    parentItemId = folder.id
  }

  return { driveId, parentItemId }
}

/** Files one document into the staff library and returns the id the portal stores. */
export async function fileInLibrary(input: {
  segments: string[]
  fileName: string
  body: Uint8Array
  contentType: string
}) {
  const folder = await ensureInternalFolder(input.segments)
  const item = await uploadFile(
    folder.driveId,
    folder.parentItemId,
    safeLibraryName(input.fileName),
    input.body,
    input.contentType,
  )

  return { driveId: folder.driveId, itemId: item.id, webUrl: item.webUrl }
}

export function libraryLink(itemId: string) {
  return downloadUrl(requireInternalDriveId(), itemId)
}

export function removeFromLibrary(itemId: string) {
  return deleteItem(requireInternalDriveId(), itemId)
}
