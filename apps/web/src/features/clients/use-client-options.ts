'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { addClientOptions, archiveClientOption } from './actions'
import { clientEvents } from './events'
import { clientKeys } from './query-keys'
import type { AddClientOptionsValues, RetireClientOptionValues } from './schema'

/** Bulk insert returns its counts so the modal can report them inline, next to the paste box. */
export function useAddClientOptions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: AddClientOptionsValues) => {
      const result = await addClientOptions(values)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => track(clientEvents.optionsAdded),
    onError: (error: Error) => {
      track(clientEvents.optionsAddFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.filterOptions() })
    },
  })
}

export function useArchiveClientOption() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: RetireClientOptionValues) => {
      const result = await archiveClientOption(values)
      if (!result.ok) throw new Error(result.message)
    },
    onSuccess: () => track(clientEvents.optionRetired),
    onError: (error: Error) => {
      track(clientEvents.optionRetireFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.filterOptions() })
    },
  })
}
