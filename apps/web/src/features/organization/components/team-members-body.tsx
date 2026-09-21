'use client'

import { Button, Divider, Group, Select, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { useClientPagination } from '@/lib/use-client-pagination'
// Approvers belong to requests, but they are set per department, so they are set here.
import { DepartmentApprovers } from '@/features/requests/components/department-approvers'
import {
  useAssignableUsers,
  useAssignDepartment,
  useRemoveFromTeam,
  useTeamMembers,
} from '../hooks/use-teams'
import type { TeamPersonRow, TeamRow } from '../schema'
import { DepartmentLeads } from './department-leads'

export function TeamMembersBody({ team }: { team: TeamRow }) {
  const members = useTeamMembers(team.id)
  const assignable = useAssignableUsers()
  const assign = useAssignDepartment()
  const remove = useRemoveFromTeam(team.id)
  const [picked, setPicked] = useState<string | null>(null)
  // Its own param: the departments table behind this drawer owns ?page.
  const paged = useClientPagination(members.data, { key: 'memberPage', pageSize: 10 })

  const columns: DataTableColumn<TeamPersonRow>[] = [
    {
      key: 'person',
      header: 'Person',
      rowHeader: true,
      render: (person) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {person.name}
          </Text>
          <Text size="xs" c="dimmed">
            {person.jobTitle ?? person.email}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 110,
      align: 'right',
      render: (person) => (
        <Button
          variant="subtle"
          color="red"
          size="compact-sm"
          aria-label={`Remove ${person.name} from ${team.name}`}
          onClick={() => remove.mutate({ userId: person.userId, teamId: team.id })}
        >
          Remove
        </Button>
      ),
    },
  ]

  const candidates = (assignable.data ?? []).filter((person) => person.teamId !== team.id)
  const chosen = candidates.find((person) => person.userId === picked)

  return (
    <Stack gap="lg">
      <DepartmentLeads teamId={team.id} teamName={team.name} canEdit />

      <Divider />

      <DepartmentApprovers teamId={team.id} teamName={team.name} />

      <Divider />

      <Stack gap="xs">
        <Select
          label="Add someone to this department"
          description="Everyone belongs to one department, so this moves them out of their current one."
          placeholder="Search people"
          searchable
          nothingFoundMessage="Nobody left to add"
          value={picked}
          onChange={setPicked}
          disabled={assignable.isPending}
          data={candidates.map((person) => ({
            value: person.userId,
            label: person.teamName ? `${person.name} · ${person.teamName}` : person.name,
          }))}
        />
        <Group>
          <Button
            disabled={!chosen}
            loading={assign.isPending}
            onClick={() => {
              if (!chosen) return
              assign.mutate({ userId: chosen.userId, teamId: team.id, teamName: team.name })
              setPicked(null)
            }}
          >
            {chosen ? `Move ${chosen.name} here` : 'Move here'}
          </Button>
        </Group>
      </Stack>

      <Divider />

      <DataTable
        label={`People in ${team.name}`}
        columns={columns}
        rows={paged.rows}
        pageInfo={paged.pageInfo}
        onPageChange={paged.onPageChange}
        rowKey={(person) => person.userId}
        isPending={members.isPending}
        isError={members.isError}
        isFetching={members.isFetching}
        error={members.error}
        onRetry={() => members.refetch()}
        minWidth={360}
        stickyHeader={false}
        skeletonRows={3}
        empty={
          <EmptyState
            title="Nobody here yet"
            description="Move someone into this department and they will see it on their dashboard."
          />
        }
      />
    </Stack>
  )
}
