'use client'

import { useQuery } from '@tanstack/react-query'
import { useOptimisticListMutation } from '@/lib/optimistic'
import {
  assignDepartment,
  createTeam,
  deleteTeam,
  listAssignableUsers,
  listTeamMembers,
  listTeams,
  removeFromTeam,
  renameTeam,
} from '../actions'
import { organizationEvents } from '../events'
import { organizationKeys } from '../query-keys'
import type {
  AssignableUserRow,
  AssignDepartmentValues,
  CreateTeamValues,
  RemoveFromTeamValues,
  RenameTeamValues,
  TeamPersonRow,
  TeamRow,
} from '../schema'

export function useTeams() {
  return useQuery({
    queryKey: organizationKeys.teams(),
    queryFn: async () => {
      const result = await listTeams()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
  })
}

export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.teamMembers(teamId ?? 'none'),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const result = await listTeamMembers(teamId)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
  })
}

export function useAssignableUsers() {
  return useQuery({
    queryKey: organizationKeys.assignable(),
    queryFn: async () => {
      const result = await listAssignableUsers()
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
  })
}

export function useCreateTeam() {
  return useOptimisticListMutation<TeamRow, CreateTeamValues>({
    queryKey: organizationKeys.teams(),
    mutationFn: async (values) => {
      const result = await createTeam(values)
      if (!result.ok) throw new Error(result.message)
    },
    // The server's id arrives with the refetch, so the pending row carries a temporary one.
    apply: (rows, values) =>
      [
        ...rows,
        {
          id: `pending-${values.name}`,
          name: values.name,
          memberCount: 0,
          createdAt: new Date().toISOString(),
        },
      ].sort((left, right) => left.name.localeCompare(right.name)),
    successEvent: organizationEvents.teamCreated,
    failureEvent: organizationEvents.teamCreateFailed,
    alsoInvalidate: [organizationKeys.summary()],
  })
}

export function useRenameTeam() {
  return useOptimisticListMutation<TeamRow, RenameTeamValues>({
    queryKey: organizationKeys.teams(),
    mutationFn: async (values) => {
      const result = await renameTeam(values)
      if (!result.ok) throw new Error(result.message)
    },
    apply: (rows, values) =>
      rows
        .map((row) => (row.id === values.teamId ? { ...row, name: values.name } : row))
        .sort((left, right) => left.name.localeCompare(right.name)),
    successEvent: organizationEvents.teamRenamed,
    failureEvent: organizationEvents.teamRenameFailed,
  })
}

export function useDeleteTeam() {
  return useOptimisticListMutation<TeamRow, { teamId: string }>({
    queryKey: organizationKeys.teams(),
    mutationFn: async (values) => {
      const result = await deleteTeam(values)
      if (!result.ok) throw new Error(result.message)
    },
    apply: (rows, values) => rows.filter((row) => row.id !== values.teamId),
    successEvent: organizationEvents.teamDeleted,
    failureEvent: organizationEvents.teamDeleteFailed,
    alsoInvalidate: [organizationKeys.summary()],
  })
}

export function useAssignDepartment() {
  return useOptimisticListMutation<
    AssignableUserRow,
    AssignDepartmentValues & { teamName: string }
  >({
    queryKey: organizationKeys.assignable(),
    mutationFn: async ({ userId, teamId }) => {
      const result = await assignDepartment({ userId, teamId })
      if (!result.ok) throw new Error(result.message)
    },
    apply: (rows, values) =>
      rows.map((row) =>
        row.userId === values.userId
          ? { ...row, teamId: values.teamId, teamName: values.teamName }
          : row,
      ),
    successEvent: organizationEvents.departmentAssigned,
    failureEvent: organizationEvents.departmentAssignFailed,
    // A move changes both team rosters and every count, so the whole feature refetches.
    alsoInvalidate: [organizationKeys.all],
  })
}

export function useRemoveFromTeam(teamId: string) {
  return useOptimisticListMutation<TeamPersonRow, RemoveFromTeamValues>({
    queryKey: organizationKeys.teamMembers(teamId),
    mutationFn: async (values) => {
      const result = await removeFromTeam(values)
      if (!result.ok) throw new Error(result.message)
    },
    apply: (rows, values) => rows.filter((row) => row.userId !== values.userId),
    successEvent: organizationEvents.departmentCleared,
    failureEvent: organizationEvents.departmentClearFailed,
    alsoInvalidate: [organizationKeys.teams(), organizationKeys.assignable()],
  })
}
