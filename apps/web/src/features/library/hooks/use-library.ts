'use client'

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { libraryFileLink, listLibraryFolder } from '../actions'
import { libraryEvents } from '../events'
import { libraryKeys } from '../query-keys'
import type { LibraryQuery } from '../schema'

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
