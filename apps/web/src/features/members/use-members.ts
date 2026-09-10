'use client'

import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { listMembers, setBanned, setOrganizationRole, setPortalRole } from './actions'
import { memberEvents } from './events'
import { memberKeys } from './query-keys'
import type { MemberRow, OrganizationRole, PortalRole } from './schema'

export function useMembers() {
  return useQuery({
    queryKey: memberKeys.list(),
    queryFn: async () => {
      const result = await listMembers()
      if (!result.ok) throw new Error(result.message)
      return result.members
    },
  })
}

// A rollback the user cannot see reads as the click never landing, so it is announced.
function announceRollback(message: string) {
  notifications.show({ color: 'red', autoClose: false, message })
}

function useRowMutation<TVariables extends { userId: string }>(options: {
  mutationFn: (variables: TVariables) => Promise<void>
  patch: (row: MemberRow, variables: TVariables) => MemberRow
  successEvent: string
  failureEvent: string
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      // An in-flight list refetch would land on top of the optimistic row.
      await queryClient.cancelQueries({ queryKey: memberKeys.list() })
      const previous = queryClient.getQueryData<MemberRow[]>(memberKeys.list())

      queryClient.setQueryData<MemberRow[]>(memberKeys.list(), (rows) =>
        rows?.map((row) => (row.userId === variables.userId ? options.patch(row, variables) : row)),
      )

      return { previous }
    },
    onError: (error: Error, _variables, context) => {
      queryClient.setQueryData(memberKeys.list(), context?.previous)
      track(options.failureEvent as `${string}.${string}.${string}`, { reason: error.message })
      announceRollback(error.message)
    },
    onSuccess: () => {
      track(options.successEvent as `${string}.${string}.${string}`)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.list() })
    },
  })
}

export function useSetOrganizationRole() {
  return useRowMutation<{ userId: string; memberId: string; role: OrganizationRole }>({
    mutationFn: async ({ memberId, role }) => {
      const result = await setOrganizationRole({ memberId, role })
      if (!result.ok) throw new Error(result.message)
    },
    patch: (row, { role }) => ({ ...row, organizationRole: role }),
    successEvent: memberEvents.roleChanged,
    failureEvent: memberEvents.roleChangeFailed,
  })
}

export function useSetPortalRole() {
  return useRowMutation<{ userId: string; role: PortalRole }>({
    mutationFn: async ({ userId, role }) => {
      const result = await setPortalRole({ userId, role })
      if (!result.ok) throw new Error(result.message)
    },
    patch: (row, { role }) => ({ ...row, portalRole: role }),
    successEvent: memberEvents.roleChanged,
    failureEvent: memberEvents.roleChangeFailed,
  })
}

export function useSetBanned() {
  return useRowMutation<{ userId: string; banned: boolean }>({
    mutationFn: async ({ userId, banned }) => {
      const result = await setBanned({ userId, banned })
      if (!result.ok) throw new Error(result.message)
    },
    patch: (row, { banned }) => ({ ...row, banned }),
    successEvent: memberEvents.banToggled,
    failureEvent: memberEvents.banToggleFailed,
  })
}
