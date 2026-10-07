'use client'

import {
  keepPreviousData,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { track, type EventName } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import {
  addLibraryFolder,
  listLibraryFolder,
  removeFromLibraryFolder,
  renameInLibrary,
  sendLibraryUploadChunk,
  startLibraryUpload,
  uploadToLibraryFolder,
} from '../actions'
import { libraryEvents } from '../events'
import { libraryKeys } from '../query-keys'
import { LIBRARY_CHUNK_BYTES, uploadProblem, type LibraryEntry, type LibraryQuery } from '../schema'
import { joinLibraryPath } from '../utils/library-path'
import type { LibraryUpload } from '../utils/upload-tree'

interface Listing {
  path: string
  entries: LibraryEntry[]
}

export function useLibraryFolder(query: LibraryQuery) {
  return useQuery({
    queryKey: libraryKeys.folder(query),
    queryFn: async () => {
      const result = await listLibraryFolder(query)
      if (!result.ok) {
        track(libraryEvents.browseFailed, { reason: result.message })
        throw new Error(result.message)
      }
      track(libraryEvents.browsed, { depth: result.path ? result.path.split('/').length : 0 })
      return { path: result.path, entries: result.entries }
    },
    // Opening a folder keeps the previous one on screen instead of blanking the table.
    placeholderData: keepPreviousData,
  })
}

/** Every write applies to the open folder first and is put back exactly as it was on failure. */
function useFolderMutation<TInput, TData>(
  query: LibraryQuery,
  options: {
    mutationKey?: readonly unknown[]
    /** Mutations sharing a scope run one after another instead of all at once. */
    scope?: { id: string }
    run: (input: TInput) => Promise<TData>
    apply: (entries: LibraryEntry[], input: TInput) => LibraryEntry[]
    done: EventName
    failed: EventName
  },
) {
  const queryClient = useQueryClient()
  const key = libraryKeys.folder(query)

  return useMutation({
    mutationKey: options.mutationKey,
    scope: options.scope,
    mutationFn: options.run,
    onMutate: async (input: TInput) => {
      // An in-flight refetch would land on top of the optimistic folder.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Listing>(key)
      queryClient.setQueryData<Listing>(key, (listing) =>
        listing ? { ...listing, entries: options.apply(listing.entries, input) } : listing,
      )
      return { previous }
    },
    onSuccess: () => track(options.done),
    onError: (error: Error, _input, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(options.failed, {
        reason: typeof error.cause === 'string' ? error.cause : error.message,
      })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all })
    },
  })
}

/** A row the server has not acknowledged yet; the id is replaced when the listing refetches. */
function pendingEntry(name: string, path: string, isFolder: boolean): LibraryEntry {
  return {
    id: crypto.randomUUID(),
    name,
    isFolder,
    path: joinLibraryPath(path, name),
    size: undefined,
    contentType: undefined,
    lastModifiedAt: new Date().toISOString(),
    childCount: isFolder ? 0 : undefined,
  }
}

/** A file in a subfolder shows as that subfolder's row, added once however many files it holds. */
function withUpload(entries: LibraryEntry[], upload: LibraryUpload, path: string) {
  const top = upload.folder.split('/')[0]
  if (!top) return [...entries, pendingEntry(upload.file.name, path, false)]
  if (entries.some((entry) => entry.isFolder && entry.name === top)) return entries
  return [pendingEntry(top, path, true), ...entries]
}

/** One request for a small file; a large one goes up in ranges, each far under the body cap. */
async function sendUpload(upload: LibraryUpload, path: string) {
  const { file, folder } = upload

  if (file.size <= LIBRARY_CHUNK_BYTES) {
    const formData = new FormData()
    formData.set('path', path)
    formData.set('folder', folder)
    formData.set('file', file)
    return uploadToLibraryFolder(formData)
  }

  const started = await startLibraryUpload({ path, folder, name: file.name, size: file.size })
  if (!started.ok) return started

  for (let start = 0; start < file.size; start += LIBRARY_CHUNK_BYTES) {
    const formData = new FormData()
    formData.set('token', started.data.token)
    formData.set('start', String(start))
    formData.set('chunk', file.slice(start, start + LIBRARY_CHUNK_BYTES))
    const sent = await sendLibraryUploadChunk(formData)
    if (!sent.ok) return sent
    if (sent.data.entry) return { ok: true as const, data: sent.data.entry }
  }
  return { ok: false as const, message: 'SharePoint did not confirm the upload — try again.' }
}

const UPLOAD_KEY = [...libraryKeys.all, 'upload'] as const

/** Files still on their way up, so a forty-file drop can say how many are left. */
export function useUploadsInFlight() {
  return useIsMutating({ mutationKey: UPLOAD_KEY })
}

export function useUploadToLibrary(query: LibraryQuery) {
  return useFolderMutation<LibraryUpload, LibraryEntry>(query, {
    mutationKey: UPLOAD_KEY,
    scope: { id: 'library-upload' },
    run: async (upload) => {
      // Checked here too, so an oversized file fails at once instead of as a 413 from nginx.
      const problem = uploadProblem(upload.file)
      const result = problem
        ? { ok: false as const, message: problem }
        : await sendUpload(upload, query.path)
      // The name tells the user which file of many failed; analytics only ever sees the cause.
      if (!result.ok) {
        throw new Error(`${upload.file.name}: ${result.message}`, { cause: result.message })
      }
      return result.data
    },
    apply: (entries, upload) => withUpload(entries, upload, query.path),
    done: libraryEvents.uploaded,
    failed: libraryEvents.uploadFailed,
  })
}

export function useCreateLibraryFolder(query: LibraryQuery) {
  return useFolderMutation<string, LibraryEntry>(query, {
    run: async (name) => {
      const result = await addLibraryFolder({ path: query.path, name })
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    apply: (entries, name) => [pendingEntry(name, query.path, true), ...entries],
    done: libraryEvents.folderCreated,
    failed: libraryEvents.folderCreateFailed,
  })
}

export function useRenameLibraryItem(query: LibraryQuery) {
  return useFolderMutation<{ itemId: string; name: string }, LibraryEntry>(query, {
    run: async (input) => {
      const result = await renameInLibrary(input)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    apply: (entries, input) =>
      entries.map((entry) =>
        entry.id === input.itemId
          ? { ...entry, name: input.name, path: joinLibraryPath(query.path, input.name) }
          : entry,
      ),
    done: libraryEvents.renamed,
    failed: libraryEvents.renameFailed,
  })
}

export function useDeleteLibraryItem(query: LibraryQuery) {
  return useFolderMutation<{ itemId: string; name: string }, { id: string }>(query, {
    run: async (input) => {
      const result = await removeFromLibraryFolder({ itemId: input.itemId })
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    apply: (entries, input) => entries.filter((entry) => entry.id !== input.itemId),
    done: libraryEvents.deleted,
    failed: libraryEvents.deleteFailed,
  })
}
