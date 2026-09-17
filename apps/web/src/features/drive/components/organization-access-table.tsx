'use client'

import { Anchor, Badge, Button, Group, SegmentedControl, Stack, Text } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { SearchField } from '@/components/search-field'
import {
  useOrganizationAccess,
  useRevokeOrganizationAccess,
} from '../hooks/use-organization-access'
import { useOrganizationAccessQuery } from '../hooks/use-organization-access-query'
import type { AccessSortKey, AccessView, OrganizationAccessRow } from '../schema'

const VIEW_OPTIONS: { value: AccessView; label: string }[] = [
  { value: 'active', label: 'Can open' },
  { value: 'removed', label: 'Removed' },
  { value: 'all', label: 'All' },
]

const stamp = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export function OrganizationAccessTable() {
  const { query, setQuery, clearFilters } = useOrganizationAccessQuery()
  const access = useOrganizationAccess(query)
  const revoke = useRevokeOrganizationAccess(query)

  const columns: DataTableColumn<OrganizationAccessRow>[] = [
    {
      key: 'email',
      header: 'Person',
      rowHeader: true,
      sortable: true,
      render: (row) => (
        <Text size="sm" fw={500}>
          {row.email}
        </Text>
      ),
    },
    {
      key: 'clientName',
      header: 'Client folder',
      render: (row) =>
        row.folderUrl ? (
          <Anchor href={row.folderUrl} target="_blank" rel="noreferrer" size="sm">
            {row.clientName}
          </Anchor>
        ) : (
          <Text size="sm">{row.clientName}</Text>
        ),
    },
    {
      key: 'invitedAt',
      header: 'Shared',
      sortable: true,
      render: (row) => <Text size="sm">{stamp.format(new Date(row.invitedAt))}</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.revokedAt ? (
          <Badge color="gray" variant="light">
            {`Removed ${stamp.format(new Date(row.revokedAt))}`}
          </Badge>
        ) : (
          <Badge color="green" variant="light">
            Can read
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 150,
      render: (row) =>
        row.revokedAt ? null : (
          <Button
            variant="subtle"
            color="red"
            size="compact-sm"
            disabled={revoke.isPending}
            onClick={() =>
              revoke.mutate({ id: row.id, email: row.email, clientName: row.clientName })
            }
          >
            Remove access
          </Button>
        ),
    },
  ]

  const isFiltered = query.search !== '' || query.view !== 'active'

  return (
    <Stack gap="md">
      <Group role="search" aria-label="Filter folder access" align="flex-end" wrap="wrap" gap="sm">
        <SearchField
          label="folder access"
          labelVisible
          placeholder="Email or client"
          width={260}
          initial={query.search}
          onSearch={(search) => setQuery({ search })}
        />
        <Stack gap={4}>
          <Text size="sm" fw={500} component="span" id="access-view-label">
            View
          </Text>
          <SegmentedControl
            aria-labelledby="access-view-label"
            data={VIEW_OPTIONS}
            value={query.view}
            onChange={(view) => setQuery({ view: view as AccessView })}
          />
        </Stack>
      </Group>

      <DataTable
        label="Folder access"
        columns={columns}
        rows={access.data?.rows}
        rowKey={(row) => row.id}
        isPending={access.isPending}
        isError={access.isError}
        isFetching={access.isFetching}
        error={access.error}
        errorTitle="Could not load folder access"
        onRetry={() => access.refetch()}
        isFiltered={isFiltered}
        empty={
          <EmptyState
            title="Nobody outside the company can open a client folder"
            description="Share one from a client's actions menu and it is listed here with a way to take it back."
          />
        }
        noResults={
          <EmptyState
            title="No access matches those filters"
            description="Widen the search or switch the view to see the rest."
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        }
        pageInfo={access.data?.pageInfo}
        onPageChange={(page) => setQuery({ page })}
        sort={{ key: query.sortBy, direction: query.sortDirection }}
        onSortChange={({ key, direction }) =>
          setQuery({ sortBy: key as AccessSortKey, sortDirection: direction })
        }
      />
    </Stack>
  )
}
