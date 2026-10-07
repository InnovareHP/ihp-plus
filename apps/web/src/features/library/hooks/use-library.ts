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
  uploadToLibraryFolder,
} from '../actions'
import { libraryEvents } from '../events'
import { libraryKeys } from '../query-keys'
import type { LibraryEntry, LibraryQuery } from '../schema'
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

const UPLOAD_KEY = [...libraryKeys.all, 'upload'] as const

/** Files still on their way up, so a forty-file drop can say how many are left. */
export function useUploadsInFlight() {
  return useIsMutating({ mutationKey: UPLOAD_KEY })
}

export function useUploadToLibrary(query: LibraryQuery) {
  return useFolderMutation<LibraryUpload, LibraryEntry>(query, {
    mutationKey: UPLOAD_KEY,
    run: async (upload) => {
      const formData = new FormData()
      formData.set('path', query.path)
      formData.set('folder', upload.folder)
      formData.set('file', upload.file)
      const result = await uploadToLibraryFolder(formData)
      // The name tells the user which file of many failed; analytics only ever sees the cause.
      if (!result.ok)
        throw new Error(`${upload.file.name}: ${result.message}`, { cause: result.message })
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
