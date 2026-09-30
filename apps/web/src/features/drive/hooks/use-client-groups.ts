'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import {
  addClientToGroup,
  createClientGroup,
  deleteClientGroup,
  listClientGroups,
  removeClientFromGroup,
} from '../actions'
import { driveEvents } from '../events'
import { driveKeys } from '../query-keys'
import type {
  ClientGroupRow,
  ClientGroupsView,
  ClientGroupValues,
  GroupMemberInput,
} from '../schema'
import { withGroup, withMember, withoutGroup, withoutMember } from '../utils/group-view'

export function useClientGroups() {
  return useQuery({
    queryKey: driveKeys.groups(),
    queryFn: async () => {
      const result = await listClientGroups()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
  })
}

/** Every group mutation edits the one cached view, so they share snapshot and rollback. */
function useGroupsMutation<TInput, TData>(options: {
  mutationFn: (input: TInput) => Promise<TData>
  apply: (view: ClientGroupsView, input: TInput) => ClientGroupsView
  settle?: (view: ClientGroupsView, data: TData, input: TInput) => ClientGroupsView
  failedEvent: (typeof driveEvents)[keyof typeof driveEvents]
}) {
  const queryClient = useQueryClient()
  const key = driveKeys.groups()

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (input: TInput) => {
      // An in-flight refetch would land on top of the optimistic view.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ClientGroupsView>(key)
      queryClient.setQueryData<ClientGroupsView>(key, (view) =>
        view ? options.apply(view, input) : view,
      )
      return { previous }
    },
    onSuccess: (data, input) => {
      const { settle } = options
      if (!settle) return
      queryClient.setQueryData<ClientGroupsView>(key, (view) =>
        view ? settle(view, data, input) : view,
      )
    },
    onError: (error: Error, _input, context) => {
      queryClient.setQueryData(key, context?.previous)
      track(options.failedEvent, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      // A move changes folder links in the access table too, not only the group list.
      queryClient.invalidateQueries({ queryKey: driveKeys.all })
    },
  })
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }) {
  if (!result.ok) throw new Error(result.message)
  return result.data
}

/** The caller mints `tempId`; the server's row replaces it on success. */
export function useCreateClientGroup() {
  return useGroupsMutation<ClientGroupValues & { tempId: string }, ClientGroupRow>({
    mutationFn: async ({ name }) => unwrap(await createClientGroup({ name })),
    apply: (view, { name, tempId }) =>
      withGroup(view, {
        id: tempId,
        name: name.trim(),
        webUrl: undefined,
        activeGrants: 0,
        members: [],
      }),
    settle: (view, saved, { tempId }) => withGroup(withoutGroup(view, tempId), saved),
    failedEvent: driveEvents.groupCreateFailed,
  })
}

export function useAddClientToGroup() {
  return useGroupsMutation<GroupMemberInput, null>({
    mutationFn: async (input) => unwrap(await addClientToGroup(input)),
    apply: (view, { groupId, clientId }) => withMember(view, groupId, clientId),
    failedEvent: driveEvents.groupMemberFailed,
  })
}

export function useRemoveClientFromGroup() {
  return useGroupsMutation<GroupMemberInput, null>({
    mutationFn: async (input) => unwrap(await removeClientFromGroup(input)),
    apply: (view, { clientId }) => withoutMember(view, clientId),
    failedEvent: driveEvents.groupMemberFailed,
  })
}

export function useDeleteClientGroup() {
  return useGroupsMutation<{ id: string }, null>({
    mutationFn: async ({ id }) => unwrap(await deleteClientGroup(id)),
    apply: (view, { id }) => withoutGroup(view, id),
    failedEvent: driveEvents.groupDeleteFailed,
  })
}
