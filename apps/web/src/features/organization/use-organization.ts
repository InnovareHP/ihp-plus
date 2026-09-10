'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { getOrganizationSummary, updateOrganizationProfile } from './actions'
import { organizationEvents } from './events'
import { organizationKeys } from './query-keys'
import type { OrganizationProfileValues, OrganizationSummary } from './schema'

export function useOrganizationSummary() {
  return useQuery({
    queryKey: organizationKeys.summary(),
    queryFn: async () => {
      const result = await getOrganizationSummary()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
  })
}

export function useUpdateOrganizationProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: OrganizationProfileValues) => {
      const result = await updateOrganizationProfile(values)
      if (!result.ok) throw new Error(result.message)
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: organizationKeys.summary() })
      const previous = queryClient.getQueryData<OrganizationSummary>(organizationKeys.summary())
      if (previous) {
        queryClient.setQueryData<OrganizationSummary>(organizationKeys.summary(), {
          ...previous,
          ...values,
        })
      }
      return { previous }
    },
    onError: (error: Error, _values, context) => {
      queryClient.setQueryData(organizationKeys.summary(), context?.previous)
      track(organizationEvents.profileUpdateFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSuccess: () => {
      track(organizationEvents.profileUpdated)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.summary() })
    },
  })
}
