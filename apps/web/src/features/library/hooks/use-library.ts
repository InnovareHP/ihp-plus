'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track, type EventName } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import {
  addLibraryFolder,
  libraryFileLink,
  listLibraryFolder,
  removeFromLibraryFolder,
  renameInLibrary,
  uploadToLibraryFolder,
} from '../actions'
import { libraryEvents } from '../events'
import { libraryKeys } from '../query-keys'
import type { LibraryEntry, LibraryQuery } from '../schema'
import { joinLibraryPath } from '../utils/library-path'

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

export function useOpenLibraryFile() {
  return useMutation({
    mutationFn: async (itemId: string) => {
      const result = await libraryFileLink({ itemId })
      if (!result.ok) throw new Error(result.message)
      return result.data.url
    },
    onSuccess: (url) => {
      track(libraryEvents.opened)
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    onError: (error: Error) => {
      track(libraryEvents.openFailed, { reason: error.message })
      announceFailure(error.message)
    },
  })
}

/** Every write applies to the open folder first and is put back exactly as it was on failure. */
function useFolderMutation<TInput, TData>(
  query: LibraryQuery,
  options: {
    run: (input: TInput) => Promise<TData>
    apply: (entries: LibraryEntry[], input: TInput) => LibraryEntry[]
    done: EventName
    failed: EventName
  },
) {
  const queryClient = useQueryClient()
  const key = libraryKeys.folder(query)

  return useMutation({
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
      track(options.failed, { reason: error.message })
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

export function useUploadToLibrary(query: LibraryQuery) {
  return useFolderMutation<File, LibraryEntry>(query, {
    run: async (file) => {
      const formData = new FormData()
      formData.set('path', query.path)
      formData.set('file', file)
      const result = await uploadToLibraryFolder(formData)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    apply: (entries, file) => [...entries, pendingEntry(file.name, query.path, false)],
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
