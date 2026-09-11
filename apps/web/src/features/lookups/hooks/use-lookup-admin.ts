'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { addLookupOptions, listLookupOptions, retireLookupOption } from '../actions'
import { lookupKeys } from './use-lookup'
import type { AddLookupOptionsValues, LookupKind, RetireLookupOptionValues } from '../schema'

/** Every list a screen needs, in one request, kept warm because they change rarely. */
export function useLookupLists(kinds: readonly LookupKind[]) {
  return useQuery({
    queryKey: [...lookupKeys.all, 'lists', ...kinds],
    queryFn: async () => {
      const result = await listLookupOptions([...kinds])
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

function useListInvalidation() {
  const queryClient = useQueryClient()
  // Both the per-kind reads (useLookup) and the batched ones go stale on a curation change.
  return () => queryClient.invalidateQueries({ queryKey: lookupKeys.all })
}

/** Bulk insert returns its counts so the modal can report them inline, next to the paste box. */
export function useAddLookupOptions() {
  const invalidate = useListInvalidation()

  return useMutation({
    mutationFn: async (values: AddLookupOptionsValues) => {
      const result = await addLookupOptions(values)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => track('lookups.option.bulk_added'),
    onError: (error: Error) => {
      track('lookups.option.bulk_add_failed', { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: invalidate,
  })
}

export function useRetireLookupOption() {
  const invalidate = useListInvalidation()

  return useMutation({
    mutationFn: async (values: RetireLookupOptionValues) => {
      const result = await retireLookupOption(values)
      if (!result.ok) throw new Error(result.message)
    },
    onSuccess: () => track('lookups.option.retired'),
    onError: (error: Error) => {
      track('lookups.option.retire_failed', { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: invalidate,
  })
}
