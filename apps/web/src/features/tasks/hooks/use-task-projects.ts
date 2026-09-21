'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track, type EventName } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { taskEvents } from '../events'
import { taskKeys } from '../query-keys'
import {
  createList,
  createProject,
  createStatus,
  deleteList,
  deleteStatus,
  listLists,
  listProjects,
  listStatuses,
  reorderStatus,
  updateList,
  updateProject,
  updateStatus,
} from '../rpc'
import type {
  ListFormValues,
  ProjectFormValues,
  StatusFormValues,
  UpdateProjectValues,
  UpdateStatusValues,
} from '../schema'

export function useTaskProjects(includeArchived = false) {
  return useQuery({
    queryKey: taskKeys.projects(includeArchived),
    queryFn: () => listProjects(includeArchived),
  })
}

export function useTaskLists(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.lists(projectId ?? ''),
    queryFn: () => listLists(projectId as string),
    enabled: Boolean(projectId),
  })
}

export function useTaskStatuses() {
  return useQuery({
    queryKey: taskKeys.statuses(),
    queryFn: listStatuses,
    // What the columns are called changes far less often than the work inside them.
    staleTime: 30 * 60 * 1000,
  })
}

// Not optimistic: the server assigns the id, and the new project is what the board switches to.
export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: ProjectFormValues) => createProject(values),
    onSuccess: () => {
      track(taskEvents.projectCreated)
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (error: Error) => {
      track(taskEvents.projectCreateFailed, { reason: error.message })
      announceFailure(error.message)
    },
  })
}

// Not optimistic: a list only matters once it has a server id to create tasks against.
export function useCreateList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: ListFormValues) => createList(values),
    onSuccess: (list) => {
      track(taskEvents.listCreated)
      queryClient.invalidateQueries({ queryKey: taskKeys.lists(list.projectId) })
    },
    onError: (error: Error) => {
      track(taskEvents.listCreateFailed, { reason: error.message })
      announceFailure(error.message)
    },
  })
}

/**
 * Board furniture — projects, lists, columns — is changed rarely and read everywhere, so these
 * refetch rather than patch: an optimistic column is not worth the cache surgery.
 */
function useSettingsMutation<TVariables, TResult>(options: {
  mutationFn: (variables: TVariables) => Promise<TResult>
  successEvent: EventName
  failureEvent: EventName
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: () => {
      track(options.successEvent)
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (error: Error) => {
      track(options.failureEvent, { reason: error.message })
      announceFailure(error.message)
    },
  })
}

export function useUpdateProject() {
  return useSettingsMutation({
    mutationFn: (values: UpdateProjectValues) => updateProject(values),
    successEvent: taskEvents.projectUpdated,
    failureEvent: taskEvents.projectUpdateFailed,
  })
}

export function useUpdateList() {
  return useSettingsMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) => updateList(listId, name),
    successEvent: taskEvents.listUpdated,
    failureEvent: taskEvents.listUpdateFailed,
  })
}

export function useDeleteList() {
  return useSettingsMutation({
    mutationFn: ({ listId }: { listId: string }) => deleteList(listId),
    successEvent: taskEvents.listDeleted,
    failureEvent: taskEvents.listDeleteFailed,
  })
}

export function useCreateStatus() {
  return useSettingsMutation({
    mutationFn: (values: StatusFormValues) => createStatus(values),
    successEvent: taskEvents.statusCreated,
    failureEvent: taskEvents.statusCreateFailed,
  })
}

export function useUpdateStatus() {
  return useSettingsMutation({
    mutationFn: (values: UpdateStatusValues) => updateStatus(values),
    successEvent: taskEvents.statusUpdated,
    failureEvent: taskEvents.statusUpdateFailed,
  })
}

export function useReorderStatus() {
  return useSettingsMutation({
    mutationFn: ({
      statusId,
      beforeStatusId,
    }: {
      statusId: string
      beforeStatusId: string | undefined
    }) => reorderStatus(statusId, beforeStatusId),
    successEvent: taskEvents.statusReordered,
    failureEvent: taskEvents.statusReorderFailed,
  })
}

export function useDeleteStatus() {
  return useSettingsMutation({
    mutationFn: ({ statusId, moveToStatusId }: { statusId: string; moveToStatusId?: string }) =>
      deleteStatus(statusId, moveToStatusId),
    successEvent: taskEvents.statusDeleted,
    failureEvent: taskEvents.statusDeleteFailed,
  })
}
