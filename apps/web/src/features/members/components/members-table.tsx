'use client'

import { Badge, Button, Group, Select, Stack, Text } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { useMemberFilterOptions } from '../hooks/use-members'
import {
  isFilteredQuery,
  MEMBER_STATUSES,
  ORGANIZATION_ROLES,
  PORTAL_ROLE_LABELS,
  PORTAL_ROLES,
  type MemberRow,
  type MemberSortKey,
} from '../schema'
import { useMemberQuery } from '../hooks/use-member-query'
import {
  useMembers,
  useSetBanned,
  useSetOrganizationRole,
  useSetPortalRole,
} from '../hooks/use-members'

const ORGANIZATION_OPTIONS = ORGANIZATION_ROLES.map((role) => ({ value: role, label: role }))
const PORTAL_OPTIONS = PORTAL_ROLES.map((role) => ({
  value: role,
  label: PORTAL_ROLE_LABELS[role],
}))

export function MembersTable() {
  const { query, setQuery, clearFilters } = useMemberQuery()
  const members = useMembers(query)
  const options = useMemberFilterOptions()

  const filters: readonly FilterControl[] = [
    {
      kind: 'multi',
      key: 'teamIds',
      label: 'Department',
      options: (options.data?.teams ?? []).map((team) => ({ value: team.id, label: team.name })),
    },
    {
      kind: 'multi',
      key: 'organizationRoles',
      label: 'Organization role',
      options: ORGANIZATION_OPTIONS,
    },
    { kind: 'multi', key: 'portalRoles', label: 'Portal role', options: PORTAL_OPTIONS },
    {
      kind: 'multi',
      key: 'employmentTypes',
      label: 'Employment type',
      options: (options.data?.employmentTypes ?? []).map((value) => ({ value, label: value })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Access',
      options: MEMBER_STATUSES.filter((status) => status !== 'all').map((status) => ({
        value: status,
        label: status === 'active' ? 'Active' : 'Suspended',
      })),
    },
    {
      kind: 'dateRange',
      fromKey: 'startDateFrom',
      toKey: 'startDateTo',
      label: 'Start date',
      help: 'Anyone who started between these dates.',
    },
  ]
  const organizationRole = useSetOrganizationRole()
  const portalRole = useSetPortalRole()
  const banned = useSetBanned()

  // The column key is the server's sort key, so a header click needs no translation table.
  const columns: DataTableColumn<MemberRow>[] = [
    {
      key: 'name',
      header: 'Person',
      rowHeader: true,
      sortable: true,
      render: (row) => (
        <Stack gap={0}>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" fw={500}>
              {row.name}
            </Text>
            {row.isSelf ? (
              <Badge size="xs" variant="light">
                You
              </Badge>
            ) : null}
          </Group>
          <Text size="xs" c="dimmed">
            {row.email}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'team',
      header: 'Department',
      render: (row) => <Text size="sm">{row.team ?? '—'}</Text>,
    },
    {
      key: 'organizationRole',
      header: 'Organization role',
      sortable: true,
      render: (row) => (
        <Select
          aria-label={`Organization role for ${row.name}`}
          data={ORGANIZATION_OPTIONS}
          value={row.organizationRole}
          allowDeselect={false}
          size="sm"
          w={130}
          onChange={(value) =>
            value &&
            organizationRole.mutate({
              userId: row.userId,
              memberId: row.memberId,
              role: value as MemberRow['organizationRole'],
            })
          }
        />
      ),
    },
    {
      key: 'portalRole',
      header: 'Portal role',
      sortable: true,
      render: (row) => (
        <Select
          aria-label={`Portal role for ${row.name}`}
          data={PORTAL_OPTIONS}
          value={row.portalRole}
          allowDeselect={false}
          size="sm"
          w={120}
          onChange={(value) =>
            value &&
            portalRole.mutate({
              userId: row.userId,
              role: value as MemberRow['portalRole'],
            })
          }
        />
      ),
    },
    {
      key: 'access',
      header: 'Access',
      render: (row) => (
        <Group gap="sm" wrap="nowrap">
          <Badge color={row.banned ? 'red' : 'green'} variant="light">
            {row.banned ? 'Suspended' : 'Active'}
          </Badge>
          {row.isSelf ? null : (
            <Button
              variant="subtle"
              size="compact-sm"
              color={row.banned ? undefined : 'red'}
              onClick={() => banned.mutate({ userId: row.userId, banned: !row.banned })}
            >
              {row.banned ? `Restore ${row.name}` : `Suspend ${row.name}`}
            </Button>
          )}
        </Group>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="members"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={filters}
      />

      <DataTable
        label="Members"
        columns={columns}
        rows={members.data?.rows}
        rowKey={(row) => row.memberId}
        isPending={members.isPending}
        isError={members.isError}
        error={members.error}
        errorTitle="Could not load members"
        onRetry={() => members.refetch()}
        // Only a page or filter change keeps a stale page on screen; a plain refetch stays silent.
        isFetching={members.isPlaceholderData}
        isFiltered={isFilteredQuery(query)}
        empty="Nobody has finished onboarding yet. The first person to complete it appears here."
        noResults={
          <Stack gap="sm" align="flex-start">
            <Text c="dimmed">No member matches these filters.</Text>
            <Button variant="light" onClick={clearFilters}>
              Clear filters
            </Button>
          </Stack>
        }
        pageInfo={members.data?.pageInfo}
        onPageChange={(page) => setQuery({ page })}
        sort={{ key: query.sortBy, direction: query.sortDirection }}
        onSortChange={({ key, direction }) =>
          setQuery({ sortBy: key as MemberSortKey, sortDirection: direction })
        }
      />
    </Stack>
  )
}
