'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { taskEvents } from '../events'
import { taskKeys } from '../query-keys'
import { createList, createProject, listLists, listProjects, listStatuses } from '../rpc'
import type { ListFormValues, ProjectFormValues } from '../schema'

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
