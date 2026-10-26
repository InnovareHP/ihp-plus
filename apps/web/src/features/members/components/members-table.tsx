'use client'

import { Badge, Button, Group, Select, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { useImpersonate } from '@/features/auth/hooks/use-impersonation'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { MemberPaySelect } from '@/features/attendance/components/member-pay-select'
import { MemberShiftSelect } from '@/features/attendance/components/member-shift-select'
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
import { EmploymentStatusSelect } from './employment-status-select'
import { MemberActionsMenu } from './member-actions-menu'
import { MemberWorkDetailsModal } from './member-work-details-modal'
import {
  useMembers,
  useSetBanned,
  useSetEmploymentStatus,
  useSetOrganizationRole,
  useSetPortalRole,
} from '../hooks/use-members'

// Sentence case to match the portal roles beside it; the stored value stays lower case.
const ORGANIZATION_OPTIONS = ORGANIZATION_ROLES.map((role) => ({
  value: role,
  label: role.charAt(0).toUpperCase() + role.slice(1),
}))
const PORTAL_OPTIONS = PORTAL_ROLES.map((role) => ({
  value: role,
  label: PORTAL_ROLE_LABELS[role],
}))

// Portal admins can sign in as someone; the auth plugin refuses another admin or a suspended account.
function canSignInAs(row: MemberRow) {
  return !row.isSelf && !row.banned && row.portalRole !== 'admin'
}

export function MembersTable({ canImpersonate = false }: { canImpersonate?: boolean }) {
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
      kind: 'multi',
      key: 'employmentStatuses',
      label: 'Employment status',
      options: (options.data?.employmentStatuses ?? []).map((value) => ({ value, label: value })),
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
  const statuses = options.data?.employmentStatuses ?? []
  const organizationRole = useSetOrganizationRole()
  const employmentStatus = useSetEmploymentStatus()
  const portalRole = useSetPortalRole()
  const banned = useSetBanned()
  const impersonate = useImpersonate()
  // Whose shift, pay and status are open on a phone is a disclosure nothing else reads.
  const [editing, setEditing] = useState<MemberRow | null>(null)

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
      key: 'shift',
      header: 'Shift',
      hideOnPhone: true,
      render: (row) => <MemberShiftSelect userId={row.userId} userName={row.name} />,
    },
    {
      key: 'pay',
      header: 'Pay',
      hideOnPhone: true,
      render: (row) => <MemberPaySelect userId={row.userId} userName={row.name} />,
    },
    {
      key: 'employmentStatus',
      header: 'Employment status',
      hideOnPhone: true,
      render: (row) => (
        <EmploymentStatusSelect
          userName={row.name}
          value={row.employmentStatus}
          statuses={statuses}
          onChange={(value) =>
            employmentStatus.mutate({ userId: row.userId, employmentStatus: value })
          }
        />
      ),
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
          w={{ base: '100%', sm: 130 }}
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
          w={{ base: '100%', sm: 120 }}
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
        <Badge color={row.banned ? 'red' : 'green'} variant="light">
          {row.banned ? 'Suspended' : 'Active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 90,
      align: 'right',
      render: (row) => (
        <MemberActionsMenu
          name={row.name}
          banned={row.banned}
          canSuspend={!row.isSelf}
          canSignInAs={canImpersonate && canSignInAs(row)}
          isSigningIn={impersonate.isPending && impersonate.variables === row.userId}
          onToggleBanned={() => banned.mutate({ userId: row.userId, banned: !row.banned })}
          onSignInAs={() => impersonate.mutate(row.userId)}
          onEditWorkDetails={() => setEditing(row)}
        />
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
        onPageSizeChange={(pageSize) => setQuery({ pageSize, page: 1 })}
        sort={{ key: query.sortBy, direction: query.sortDirection }}
        onSortChange={({ key, direction }) =>
          setQuery({ sortBy: key as MemberSortKey, sortDirection: direction })
        }
      />

      {editing ? (
        <MemberWorkDetailsModal
          opened
          onClose={() => setEditing(null)}
          userId={editing.userId}
          userName={editing.name}
          // Read from the live rows, so the status shown follows a change made in the dialog.
          employmentStatus={
            members.data?.rows.find((row) => row.userId === editing.userId)?.employmentStatus ??
            editing.employmentStatus
          }
          statuses={statuses}
          onEmploymentStatusChange={(value) =>
            employmentStatus.mutate({ userId: editing.userId, employmentStatus: value })
          }
        />
      ) : null}
    </Stack>
  )
}
