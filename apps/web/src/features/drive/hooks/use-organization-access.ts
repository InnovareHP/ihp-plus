'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { listOrganizationAccess, revokeClientFolderAccess } from '../actions'
import { driveEvents } from '../events'
import { driveKeys } from '../query-keys'
import type { OrganizationAccessPage, OrganizationAccessQuery } from '../schema'

export function useOrganizationAccess(query: OrganizationAccessQuery) {
  return useQuery({
    queryKey: driveKeys.organization(query),
    queryFn: async () => {
      const result = await listOrganizationAccess(query)
      if (!result.ok) throw new Error(result.message)
      return { rows: result.rows, pageInfo: result.pageInfo }
    },
    // Paging or refiltering keeps the previous page on screen instead of blanking the table.
    placeholderData: keepPreviousData,
  })
}

export function useRevokeOrganizationAccess(query: OrganizationAccessQuery) {
  const queryClient = useQueryClient()
  const key = driveKeys.organization(query)

  return useMutation({
    mutationFn: async ({ id }: { id: string; email: string; clientName: string }) => {
      const result = await revokeClientFolderAccess(id)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onMutate: async ({ id }) => {
      // An in-flight refetch would land on top of the optimistic page.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<OrganizationAccessPage>(key)
      queryClient.setQueryData<OrganizationAccessPage>(key, (page) =>
        page
          ? {
              ...page,
              rows: page.rows.map((row) =>
                row.id === id ? { ...row, revokedAt: new Date().toISOString() } : row,
              ),
            }
          : page,
      )
      return { previous }
    },
    onSuccess: () => track(driveEvents.accessRevoked),
    onError: (error: Error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(driveEvents.accessRevokeFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: driveKeys.all })
    },
  })
}
