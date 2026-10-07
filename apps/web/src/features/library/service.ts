import {
  deleteItem,
  createUploadSession,
  ensureFolder,
  getItem,
  getItemByPath,
  GraphError,
  listAllChildren,
  openItemContent,
  renameItem,
  requireInternalDriveId,
  rootItem,
  uploadChunk,
  uploadFile,
  type DriveItem,
} from '@ihp/graph'
import { safeLibraryName } from '@/lib/library-name'
import type { LibraryEntry, LibraryListing, LibraryQuery } from './schema'
import type { LibraryRendition } from './utils/library-file'
import { joinLibraryPath, librarySegments, normalizeLibraryPath } from './utils/library-path'

export class NotAFolderError extends Error {
  constructor() {
    super('That is a file, not a folder.')
    this.name = 'NotAFolderError'
  }
}

export class NotAFileError extends Error {
  constructor() {
    super('That is a folder, not a file.')
    this.name = 'NotAFileError'
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

const THUMBNAIL_SIZE = { thumbnail: 'medium', preview: 'large' } as const

/** Reads the item first: its cTag answers a revalidation without fetching the bytes. */
export async function readLibraryFile(itemId: string) {
  const driveId = requireInternalDriveId()
  const item = await getItem(driveId, itemId)
  if (item.folder || !item.file) throw new NotAFileError()

  return {
    item,
    open: (rendition: LibraryRendition) =>
      openItemContent(
        driveId,
        itemId,
        rendition === 'original' ? undefined : THUMBNAIL_SIZE[rendition],
      ),
  }
}

/** Walks down from the root creating what is missing, so a dropped folder keeps its tree. */
async function ensureFolderPath(path: string) {
  try {
    return await folderItem(path)
  } catch (error) {
    if (!(error instanceof GraphError) || !error.isNotFound) throw error
  }

  let parent = await folderItem('')
  for (const segment of librarySegments(path)) {
    const folder = await ensureFolder(parent.driveId, parent.folder.id, segment)
    if (!folder.folder) throw new NotAFolderError()
    parent = { ...parent, path: joinLibraryPath(parent.path, segment), folder }
  }
  return parent
}

export async function uploadToLibrary(input: {
  path: string
  name: string
  body: Uint8Array
  contentType: string
}) {
  const parent = await ensureFolderPath(input.path)
  return uploadFile(
    parent.driveId,
    parent.folder.id,
    safeLibraryName(input.name),
    input.body,
    input.contentType,
  )
}

/** Opens a Graph upload session in the target folder, building the folder tree if needed. */
export async function startLibraryUploadSession(path: string, name: string) {
  const parent = await ensureFolderPath(path)
  const session = await createUploadSession(parent.driveId, parent.folder.id, safeLibraryName(name))
  return session.uploadUrl
}

export function sendLibraryChunk(
  uploadUrl: string,
  chunk: Uint8Array,
  start: number,
  total: number,
) {
  return uploadChunk(uploadUrl, chunk, start, total)
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
