'use server'

import { GraphError, GraphNotConfiguredError } from '@ihp/graph'
import { mirrorRemoval, mirrorRename, mirrorWrite } from '@/features/drive/sync'
import { pathFromRoot } from '@/features/drive/utils/mirror-path'
import { track } from '@/lib/analytics'
import { membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { libraryEvents } from './events'
import {
  createFolderSchema,
  libraryItemSchema,
  libraryQuerySchema,
  renameItemSchema,
  uploadProblem,
  type LibraryEntry,
  type LibraryListing,
} from './schema'
import {
  createLibraryFolder,
  deleteLibraryItem,
  entryOf,
  libraryDownloadUrl,
  NotAFolderError,
  readLibraryFolder,
  readLibraryItem,
  renameLibraryItem,
  uploadToLibrary,
} from './service'
import { normalizeLibraryPath } from './utils/library-path'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }
export type LibraryResult = ({ ok: true } & LibraryListing) | { ok: false; message: string }

const NO_STORAGE =
  'The internal library is not connected yet — tell an admin to set the GRAPH variables.'
const GONE = 'That folder is no longer in the internal library.'
const INVALID = 'Check the highlighted fields and try again.'
const NO_ACCESS =
  'The portal cannot read that folder — tell an admin to check its SharePoint grant.'
const UNAVAILABLE = 'SharePoint did not answer — try again in a moment.'

function messageFor(error: unknown) {
  if (error instanceof GraphNotConfiguredError) return NO_STORAGE
  if (error instanceof NotAFolderError) return GONE
  if (error instanceof GraphError) {
    if (error.isNotFound) return GONE
    if (error.status === 401 || error.status === 403) return NO_ACCESS
    return UNAVAILABLE
  }
  throw error
}

/** Reads one folder of the staff library. Everything here is internal, so any member may look. */
export async function listLibraryFolder(input?: unknown): Promise<LibraryResult> {
  await requireOnboarded()
  const query = libraryQuerySchema.parse(input ?? {})

  try {
    const listing = await readLibraryFolder(query)
    return { ok: true, ...listing }
  } catch (error) {
    return { ok: false, message: messageFor(error) }
  }
}

/** Minted per click and opened straight away, so the link never sits in the page's HTML. */
export async function libraryFileLink(input: unknown): Promise<Result<{ url: string }>> {
  await requireOnboarded()

  const parsed = libraryItemSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: GONE }

  try {
    return { ok: true, data: { url: await libraryDownloadUrl(parsed.data.itemId) } }
  } catch (error) {
    return { ok: false, message: messageFor(error) }
  }
}

async function writer() {
  const { profile } = await requireOnboarded()
  return membershipOf(profile).organizationId
}

/**
 * The write has already landed internally, so a mirror that fails is reported and left to the
 * delta sweep rather than rolled back.
 */
async function mirror(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    track(libraryEvents.mirrorFailed, {
      reason: error instanceof Error ? error.message.slice(0, 120) : 'Unknown error.',
    })
  }
}

export async function uploadToLibraryFolder(formData: FormData): Promise<Result<LibraryEntry>> {
  const organizationId = await writer()

  const path = normalizeLibraryPath(String(formData.get('path') ?? ''))
  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, message: 'Choose a file to upload.' }

  const problem = uploadProblem(file)
  if (problem) return { ok: false, message: problem }

  try {
    const item = await uploadToLibrary({
      path,
      name: file.name,
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type || 'application/octet-stream',
    })
    if (organizationId) await mirror(() => mirrorWrite(organizationId, item))
    return { ok: true, data: entryOf(item, path) }
  } catch (error) {
    return { ok: false, message: messageFor(error) }
  }
}

export async function addLibraryFolder(input: unknown): Promise<Result<LibraryEntry>> {
  const organizationId = await writer()

  const parsed = createFolderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const path = normalizeLibraryPath(parsed.data.path)
  try {
    const folder = await createLibraryFolder(path, parsed.data.name)
    if (organizationId) await mirror(() => mirrorWrite(organizationId, folder))
    return { ok: true, data: entryOf(folder, path) }
  } catch (error) {
    return { ok: false, message: messageFor(error) }
  }
}

export async function renameInLibrary(input: unknown): Promise<Result<LibraryEntry>> {
  const organizationId = await writer()

  const parsed = renameItemSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  try {
    // Read first: the client copy is found by the name it was mirrored under.
    const before = await readLibraryItem(parsed.data.itemId)
    const item = await renameLibraryItem(parsed.data.itemId, parsed.data.name)
    if (organizationId) await mirror(() => mirrorRename(organizationId, item, before.name))
    return { ok: true, data: entryOf(item, pathFromRoot(item) ?? '') }
  } catch (error) {
    return { ok: false, message: messageFor(error) }
  }
}

export async function removeFromLibraryFolder(input: unknown): Promise<Result<{ id: string }>> {
  const organizationId = await writer()

  const parsed = libraryItemSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: GONE }

  try {
    // Read first: once it is deleted, Graph can no longer say which client folder it was in.
    const item = await readLibraryItem(parsed.data.itemId)
    await deleteLibraryItem(parsed.data.itemId)
    if (organizationId) await mirror(() => mirrorRemoval(organizationId, item))
    return { ok: true, data: { id: parsed.data.itemId } }
  } catch (error) {
    return { ok: false, message: messageFor(error) }
  }
}
