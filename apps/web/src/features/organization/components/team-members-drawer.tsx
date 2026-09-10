'use client'

import { Alert, Button, Divider, Drawer, Group, Select, Skeleton, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { EmptyState } from '@/components/page-shell'
import type { TeamRow } from '../schema'
import {
  useAssignableUsers,
  useAssignDepartment,
  useRemoveFromTeam,
  useTeamMembers,
} from '../use-teams'

export interface TeamMembersDrawerProps {
  team: TeamRow | undefined
  onClose: () => void
}

export function TeamMembersDrawer({ team, onClose }: TeamMembersDrawerProps) {
  return (
    <Drawer
      opened={Boolean(team)}
      onClose={onClose}
      position="right"
      size="md"
      title={team ? `People in ${team.name}` : 'Department'}
    >
      {team ? <TeamMembersBody team={team} /> : null}
    </Drawer>
  )
}

function TeamMembersBody({ team }: { team: TeamRow }) {
  const members = useTeamMembers(team.id)
  const assignable = useAssignableUsers()
  const assign = useAssignDepartment()
  const remove = useRemoveFromTeam(team.id)
  const [picked, setPicked] = useState<string | null>(null)

  const candidates = (assignable.data ?? []).filter((person) => person.teamId !== team.id)
  const chosen = candidates.find((person) => person.userId === picked)

  return (
    <Stack gap="lg">
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

      {members.isPending ? (
        <Stack gap="xs" aria-busy="true">
          <Skeleton height={52} />
          <Skeleton height={52} />
          <Skeleton height={52} />
        </Stack>
      ) : members.isError ? (
        <Stack gap="md">
          <Alert role="alert" color="red" variant="light" title="Could not load this department">
            <Text size="sm">{members.error.message}</Text>
          </Alert>
          <Button onClick={() => members.refetch()} w="fit-content">
            Try again
          </Button>
        </Stack>
      ) : members.data.length === 0 ? (
        <EmptyState
          title="Nobody here yet"
          description="Move someone into this department and they will see it on their dashboard."
        />
      ) : (
        <Stack component="ul" gap="xs" m={0} p={0} style={{ listStyle: 'none' }}>
          {members.data.map((person) => (
            <Group
              component="li"
              key={person.userId}
              justify="space-between"
              wrap="nowrap"
              gap="sm"
            >
              <Stack gap={0} miw={0}>
                <Text size="sm" fw={500} truncate>
                  {person.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {person.jobTitle ?? person.email}
                </Text>
              </Stack>
              <Button
                variant="subtle"
                color="red"
                size="compact-sm"
                onClick={() => remove.mutate({ userId: person.userId, teamId: team.id })}
              >
                Remove {person.name}
              </Button>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
