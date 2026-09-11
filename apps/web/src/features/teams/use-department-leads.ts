'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track, type EventName } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
// Who leads a department decides which handbook shelves offer an upload button.
import { bluebookKeys } from '@/features/bluebook/query-keys'
import { organizationEvents } from '@/features/organization/events'
import { addDepartmentLead, listDepartmentLeads, removeDepartmentLead } from './actions'
import { teamKeys } from './query-keys'
import type { DepartmentLeadValues } from './schema'

export function useDepartmentLeads() {
  return useQuery({
    queryKey: teamKeys.leads(),
    queryFn: async () => {
      const result = await listDepartmentLeads()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
  })
}

function useLeadMutation(
  action: (values: DepartmentLeadValues) => Promise<{ ok: true } | { ok: false; message: string }>,
  events: { success: EventName; failure: EventName },
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: DepartmentLeadValues) => {
      const result = await action(values)
      if (!result.ok) throw new Error(result.message)
    },
    onSuccess: () => track(events.success),
    onError: (error: Error) => {
      track(events.failure, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.leads() })
      queryClient.invalidateQueries({ queryKey: bluebookKeys.options() })
      queryClient.invalidateQueries({ queryKey: bluebookKeys.lists() })
    },
  })
}

export function useAddDepartmentLead() {
  return useLeadMutation(addDepartmentLead, {
    success: organizationEvents.leadAdded,
    failure: organizationEvents.leadAddFailed,
  })
}

export function useRemoveDepartmentLead() {
  return useLeadMutation(removeDepartmentLead, {
    success: organizationEvents.leadRemoved,
    failure: organizationEvents.leadRemoveFailed,
  })
}
