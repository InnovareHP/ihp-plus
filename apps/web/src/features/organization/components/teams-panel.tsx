'use client'

import { ActionIcon, Badge, Button, Group, Menu, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconDotsVertical, IconPlus } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { useApprovers } from '@/features/requests/hooks/use-approvers'
import { useDepartmentLeads } from '@/features/teams/use-department-leads'
import { DEFAULT_TEAM_QUERY, teamQuerySchema, type TeamRow } from '../schema'
import { useTeams } from '../hooks/use-teams'
import { CreateTeamModal } from './create-team-modal'
import { DeleteTeamModal } from './delete-team-modal'
import { RenameTeamModal } from './rename-team-modal'
import { TeamMembersDrawer } from './team-members-drawer'

const created = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

// The open department rides in the query object too, so adjusting a filter cannot drop it.
const parseTeamQuery = searchParamsParser(teamQuerySchema)

const TEAM_FILTERS: readonly FilterControl[] = [
  {
    kind: 'toggle',
    key: 'emptyOnly',
    label: 'Only empty departments',
    help: 'Departments nobody has been placed in yet.',
  },
  {
    kind: 'toggle',
    key: 'unledOnly',
    label: 'Only departments with no lead',
    help: 'Nobody files their handbook documents or speaks for them.',
  },
  {
    kind: 'toggle',
    key: 'unapprovedOnly',
    label: 'Only departments with no approver',
    help: 'Their requests reach admins and nobody else.',
  },
]

export function TeamsPanel() {
  const teams = useTeams()
  const leads = useDepartmentLeads()
  // Reading approvers needs admin; for anyone else the column says so instead of erroring.
  const approvers = useApprovers()
  const { query, setQuery, clearFilters } = useUrlQuery(parseTeamQuery, DEFAULT_TEAM_QUERY)
  const [createOpened, createModal] = useDisclosure(false)
  const [renaming, setRenaming] = useState<TeamRow | null>(null)
  const [deleting, setDeleting] = useState<TeamRow | null>(null)

  // Who leads what is resolved once for the whole table rather than per row.
  const leadNames = useMemo(() => {
    const view = leads.data
    const byTeam = new Map<string, string[]>()
    if (!view) return byTeam

    for (const lead of view.leads) {
      const name = view.members.find((member) => member.id === lead.userId)?.name
      if (!name) continue
      byTeam.set(lead.teamId, [...(byTeam.get(lead.teamId) ?? []), name])
    }
    return byTeam
  }, [leads.data])

  // Same shape as leadNames: resolved once for the table, not per row.
  const approverNames = useMemo(() => {
    const byTeam = new Map<string, string[]>()
    for (const row of approvers.data ?? []) {
      byTeam.set(
        row.teamId,
        row.approvers.map((person) => person.name),
      )
    }
    return byTeam
  }, [approvers.data])

  const term = query.search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      teams.data?.filter(
        (team) =>
          team.name.toLowerCase().includes(term) &&
          (!query.emptyOnly || team.memberCount === 0) &&
          (!query.unledOnly || (leadNames.get(team.id) ?? []).length === 0) &&
          (!query.unapprovedOnly || (approverNames.get(team.id) ?? []).length === 0),
      ),
    [
      teams.data,
      term,
      query.emptyOnly,
      query.unledOnly,
      query.unapprovedOnly,
      leadNames,
      approverNames,
    ],
  )
  const isFiltered = term.length > 0 || query.emptyOnly || query.unledOnly || query.unapprovedOnly
  const selected = teams.data?.find((team) => team.id === query.team)

  const columns: DataTableColumn<TeamRow>[] = [
    {
      key: 'name',
      header: 'Department',
      rowHeader: true,
      render: (team) => (
        <Text size="sm" fw={500}>
          {team.name}
        </Text>
      ),
    },
    {
      key: 'people',
      header: 'People',
      width: 120,
      render: (team) => (
        <Badge variant="light" color={team.memberCount === 0 ? 'gray' : 'brand'}>
          {team.memberCount}
        </Badge>
      ),
    },
    {
      key: 'leads',
      header: 'Leads',
      render: (team) => {
        const names = leadNames.get(team.id) ?? []
        return names.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nobody yet
          </Text>
        ) : (
          <Group gap={4} wrap="wrap">
            {names.map((name) => (
              <Badge key={name} variant="light" size="sm">
                {name}
              </Badge>
            ))}
          </Group>
        )
      },
    },
    {
      key: 'approvers',
      header: 'Approvers',
      render: (team) => {
        // Only an admin may read the approver list, so for everyone else the cell says that
        // rather than claiming the department has none.
        if (approvers.isError) {
          return (
            <Text size="sm" c="dimmed">
              Admins only
            </Text>
          )
        }

        const names = approverNames.get(team.id) ?? []
        return names.length === 0 ? (
          <Text size="sm" c="dimmed">
            {approvers.isPending ? 'Loading…' : 'Nobody yet'}
          </Text>
        ) : (
          <Group gap={4} wrap="wrap">
            {names.map((name) => (
              <Badge key={name} variant="light" size="sm" color="grape">
                {name}
              </Badge>
            ))}
          </Group>
        )
      },
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: 160,
      render: (team) => (
        <Text size="sm" c="dimmed">
          {created.format(new Date(team.createdAt))}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 80,
      align: 'right',
      render: (team) => (
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${team.name}`}>
              <IconDotsVertical size={16} aria-hidden />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setQuery({ team: team.id })}>
              Manage people, leads and approvers
            </Menu.Item>
            <Menu.Item onClick={() => setRenaming(team)}>Rename</Menu.Item>
            <Menu.Item color="red" onClick={() => setDeleting(team)}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="departments"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={TEAM_FILTERS}
        action={
          <Button leftSection={<IconPlus size={16} aria-hidden />} onClick={createModal.open}>
            New department
          </Button>
        }
      />

      <DataTable
        label="Departments"
        columns={columns}
        rows={rows}
        rowKey={(team) => team.id}
        isPending={teams.isPending}
        isError={teams.isError}
        isFetching={teams.isFetching}
        error={teams.error}
        onRetry={() => teams.refetch()}
        minWidth={780}
        isFiltered={isFiltered}
        noResults={
          <EmptyState
            title="No departments match those filters"
            description="Clear them to see every department in this organization."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
        empty={
          <EmptyState
            title="No departments yet"
            description="Create the first department so people can be placed in one at setup."
            action={<Button onClick={createModal.open}>New department</Button>}
          />
        }
      />

      <CreateTeamModal opened={createOpened} onClose={createModal.close} />

      <RenameTeamModal team={renaming} onClose={() => setRenaming(null)} />

      <DeleteTeamModal team={deleting} onClose={() => setDeleting(null)} />

      <TeamMembersDrawer team={selected} onClose={() => setQuery({ team: '' })} />
    </Stack>
  )
}
