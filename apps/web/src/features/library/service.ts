import {
  deleteItem,
  downloadUrl,
  ensureFolder,
  getItem,
  getItemByPath,
  listAllChildren,
  renameItem,
  requireInternalDriveId,
  rootItem,
  uploadFile,
  type DriveItem,
} from '@ihp/graph'
import { safeLibraryName } from '@/lib/library-name'
import type { LibraryEntry, LibraryListing, LibraryQuery } from './schema'
import { joinLibraryPath, normalizeLibraryPath } from './utils/library-path'

export class NotAFolderError extends Error {
  constructor() {
    super('That is a file, not a folder.')
    this.name = 'NotAFolderError'
  }
}

export function entryOf(item: DriveItem, parentPath: string): LibraryEntry {
  return {
    id: item.id,
    name: item.name,
    isFolder: Boolean(item.folder),
    path: joinLibraryPath(parentPath, item.name),
    size: item.size,
    contentType: item.file?.mimeType,
    lastModifiedAt: item.lastModifiedDateTime,
    childCount: item.folder?.childCount,
  }
}

const byName = new Intl.Collator('en-US', { sensitivity: 'base', numeric: true })

/** Folders always lead, whatever the column: a browser that interleaves them is unreadable. */
function compare(a: LibraryEntry, b: LibraryEntry, query: LibraryQuery) {
  if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1

  const direction = query.sortDirection === 'asc' ? 1 : -1
  if (query.sortBy === 'size') return ((a.size ?? 0) - (b.size ?? 0)) * direction
  if (query.sortBy === 'lastModifiedAt') {
    return (
      ((a.lastModifiedAt ? Date.parse(a.lastModifiedAt) : 0) -
        (b.lastModifiedAt ? Date.parse(b.lastModifiedAt) : 0)) *
      direction
    )
  }
  return byName.compare(a.name, b.name) * direction
}

async function folderItem(path: string) {
  const driveId = requireInternalDriveId()
  const normalized = normalizeLibraryPath(path)
  const folder = normalized ? await getItemByPath(driveId, normalized) : await rootItem(driveId)
  if (!folder.folder) throw new NotAFolderError()
  return { driveId, path: normalized, folder }
}

export async function readLibraryFolder(query: LibraryQuery): Promise<LibraryListing> {
  const { driveId, path, folder } = await folderItem(query.path)

  const entries = (await listAllChildren(driveId, folder.id)).map((item) => entryOf(item, path))
  return { path, entries: entries.sort((a, b) => compare(a, b, query)) }
}

export function libraryDownloadUrl(itemId: string) {
  return downloadUrl(requireInternalDriveId(), itemId)
}

export async function uploadToLibrary(input: {
  path: string
  name: string
  body: Uint8Array
  contentType: string
}) {
  const parent = await folderItem(input.path)
  return uploadFile(
    parent.driveId,
    parent.folder.id,
    safeLibraryName(input.name),
    input.body,
    input.contentType,
  )
}

export async function createLibraryFolder(path: string, name: string) {
  const parent = await folderItem(path)
  return ensureFolder(parent.driveId, parent.folder.id, safeLibraryName(name, 'folder'))
}

export function readLibraryItem(itemId: string) {
  return getItem(requireInternalDriveId(), itemId)
}

export function renameLibraryItem(itemId: string, name: string) {
  return renameItem(requireInternalDriveId(), itemId, safeLibraryName(name, 'folder'))
}

export function deleteLibraryItem(itemId: string) {
  return deleteItem(requireInternalDriveId(), itemId)
}
