'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { listGroupAccess, revokeClientFolderAccess, shareGroupFolder } from '../actions'
import { driveEvents } from '../events'
import { driveKeys } from '../query-keys'
import type { ClientAccessRow, ShareFolderValues } from '../schema'

export function useGroupAccess(groupId: string, enabled = true) {
  return useQuery({
    queryKey: driveKeys.groupAccess(groupId),
    queryFn: async () => {
      const result = await listGroupAccess(groupId)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    enabled,
  })
}

export function useShareGroupFolder(groupId: string) {
  const queryClient = useQueryClient()
  const key = driveKeys.groupAccess(groupId)

  return useMutation({
    mutationFn: async (values: ShareFolderValues) => {
      const result = await shareGroupFolder({ ...values, groupId })
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onMutate: async (values) => {
      // An in-flight refetch would land on top of the optimistic row.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ClientAccessRow[]>(key)
      const added: ClientAccessRow = {
        id: crypto.randomUUID(),
        email: values.email.trim().toLowerCase(),
        role: 'read',
        invitedAt: new Date().toISOString(),
        revokedAt: undefined,
      }
      queryClient.setQueryData<ClientAccessRow[]>(key, (rows) => [
        added,
        ...(rows ?? []).filter((row) => row.email !== added.email),
      ])
      return { previous, tempId: added.id }
    },
    onSuccess: (saved, _values, context) => {
      queryClient.setQueryData<ClientAccessRow[]>(key, (rows) =>
        (rows ?? []).map((row) => (row.id === context.tempId ? saved : row)),
      )
    },
    onError: (error: Error, _values, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(driveEvents.accessShareFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      // The group's grant count and the organization table both read these rows.
      queryClient.invalidateQueries({ queryKey: driveKeys.all })
    },
  })
}

export function useRevokeGroupAccess(groupId: string) {
  const queryClient = useQueryClient()
  const key = driveKeys.groupAccess(groupId)

  return useMutation({
    mutationFn: async ({ id }: { id: string; email: string }) => {
      const result = await revokeClientFolderAccess(id)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ClientAccessRow[]>(key)
      queryClient.setQueryData<ClientAccessRow[]>(key, (rows) =>
        (rows ?? []).map((row) =>
          row.id === id ? { ...row, revokedAt: new Date().toISOString() } : row,
        ),
      )
      return { previous }
    },
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
