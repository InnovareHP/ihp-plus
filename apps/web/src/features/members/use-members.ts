'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useOptimisticPagesMutation } from '@/lib/optimistic'
import {
  listMemberFilterOptions,
  listMembers,
  setBanned,
  setOrganizationRole,
  setPortalRole,
} from './actions'
import { memberEvents } from './events'
import { memberKeys } from './query-keys'
import type { MemberQuery, MemberRow, MembersPage, OrganizationRole, PortalRole } from './schema'

export function useMembers(query: MemberQuery) {
  return useQuery({
    queryKey: memberKeys.list(query),
    queryFn: async () => {
      const result = await listMembers(query)
      if (!result.ok) throw new Error(result.message)
      return { rows: result.rows, pageInfo: result.pageInfo }
    },
    // Paging or refiltering keeps the previous page on screen instead of blanking the table.
    placeholderData: keepPreviousData,
  })
}

export function useMemberFilterOptions() {
  return useQuery({
    queryKey: memberKeys.filterOptions(),
    queryFn: async () => {
      const result = await listMemberFilterOptions()
      if (!result.ok) throw new Error(result.message)
      return result.options
    },
    // Departments change far less often than the list they filter.
    staleTime: 5 * 60 * 1000,
  })
}

function useMemberRowMutation<TVariables extends { userId: string }>(options: {
  mutationFn: (variables: TVariables) => Promise<void>
  patch: (row: MemberRow, variables: TVariables) => MemberRow
  successEvent: (typeof memberEvents)[keyof typeof memberEvents]
  failureEvent: (typeof memberEvents)[keyof typeof memberEvents]
}) {
  return useOptimisticPagesMutation<MembersPage, TVariables>({
    queryKey: memberKeys.lists(),
    mutationFn: options.mutationFn,
    apply: (page, variables) => ({
      ...page,
      rows: page.rows.map((row) =>
        row.userId === variables.userId ? options.patch(row, variables) : row,
      ),
    }),
    successEvent: options.successEvent,
    failureEvent: options.failureEvent,
  })
}

export function useSetOrganizationRole() {
  return useMemberRowMutation<{ userId: string; memberId: string; role: OrganizationRole }>({
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
  return useMemberRowMutation<{ userId: string; role: PortalRole }>({
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
  return useMemberRowMutation<{ userId: string; banned: boolean }>({
    mutationFn: async ({ userId, banned }) => {
      const result = await setBanned({ userId, banned })
      if (!result.ok) throw new Error(result.message)
    },
    patch: (row, { banned }) => ({ ...row, banned }),
    successEvent: memberEvents.banToggled,
    failureEvent: memberEvents.banToggleFailed,
  })
}
