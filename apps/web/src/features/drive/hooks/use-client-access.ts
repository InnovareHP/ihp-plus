'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { listClientAccess, revokeClientFolderAccess, shareClientFolder } from '../actions'
import { driveEvents } from '../events'
import { driveKeys } from '../query-keys'
import type { ClientAccessRow, ShareFolderValues } from '../schema'

export function useClientAccess(clientId: string, enabled = true) {
  return useQuery({
    queryKey: driveKeys.access(clientId),
    queryFn: async () => {
      const result = await listClientAccess(clientId)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    enabled,
  })
}

function optimisticRow(values: ShareFolderValues): ClientAccessRow {
  return {
    // Replaced by the server's row on settle; a list row is never keyed by its array index.
    id: crypto.randomUUID(),
    email: values.email.trim().toLowerCase(),
    role: 'read',
    invitedAt: new Date().toISOString(),
    revokedAt: undefined,
  }
}

export function useShareClientFolder(clientId: string) {
  const queryClient = useQueryClient()
  const key = driveKeys.access(clientId)

  return useMutation({
    mutationFn: async (values: ShareFolderValues) => {
      const result = await shareClientFolder({ ...values, clientId })
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onMutate: async (values) => {
      // An in-flight refetch would land on top of the optimistic row.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ClientAccessRow[]>(key)
      const added = optimisticRow(values)
      queryClient.setQueryData<ClientAccessRow[]>(key, (rows) => [
        added,
        ...(rows ?? []).filter((row) => row.email !== added.email),
      ])
      return { previous }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<ClientAccessRow[]>(key, (rows) =>
        (rows ?? []).map((row, index) => (index === 0 ? saved : row)),
      )
      track(driveEvents.accessShared)
    },
    onError: (error: Error, _values, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(driveEvents.accessShareFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function useRevokeClientAccess(clientId: string) {
  const queryClient = useQueryClient()
  const key = driveKeys.access(clientId)

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
    onSuccess: () => track(driveEvents.accessRevoked),
    onError: (error: Error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(driveEvents.accessRevokeFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
