'use server'

import { GraphError, GraphNotConfiguredError } from '@ihp/graph'
import { requireOnboarded } from '@/lib/auth-guard'
import { libraryItemSchema, libraryQuerySchema, type LibraryListing } from './schema'
import { libraryDownloadUrl, NotAFolderError, readLibraryFolder } from './service'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }
export type LibraryResult = ({ ok: true } & LibraryListing) | { ok: false; message: string }

const NO_STORAGE =
  'The internal library is not connected yet — tell an admin to set the GRAPH variables.'
const GONE = 'That folder is no longer in the internal library.'
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
