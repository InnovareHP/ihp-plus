'use client'

import { Button, Group, Stack, Text } from '@mantine/core'
import { useMemo } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { useApprovers } from '../hooks/use-approvers'
import { approverQuerySchema, DEFAULT_APPROVER_QUERY } from '../schema'
import type { DepartmentApproversRow } from '../schema'
import { AppointControl } from './appoint-control'
import { ApproverBadge } from './approver-badge'

const parseApproverQuery = searchParamsParser(approverQuerySchema)

const APPROVER_FILTERS: readonly FilterControl[] = [
  {
    kind: 'toggle',
    key: 'unstaffedOnly',
    label: 'Only departments with no approver',
    help: 'Their requests reach admins and nobody else.',
  },
]

export function ApproversPanel() {
  const departments = useApprovers()
  const { query, setQuery, clearFilters } = useUrlQuery(parseApproverQuery, DEFAULT_APPROVER_QUERY)

  const term = query.search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      departments.data?.filter(
        (row) =>
          (row.teamName.toLowerCase().includes(term) ||
            row.approvers.some((approver) => approver.name.toLowerCase().includes(term))) &&
          (!query.unstaffedOnly || row.approvers.length === 0),
      ),
    [departments.data, term, query.unstaffedOnly],
  )
  const isFiltered = term.length > 0 || query.unstaffedOnly

  const columns: DataTableColumn<DepartmentApproversRow>[] = [
    {
      key: 'department',
      header: 'Department',
      rowHeader: true,
      width: 220,
      render: (row) => (
        <Text size="sm" fw={500}>
          {row.teamName}
        </Text>
      ),
    },
    {
      key: 'approvers',
      header: 'Approvers',
      render: (row) =>
        row.approvers.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nobody yet — its requests reach admins only.
          </Text>
        ) : (
          <Group gap="xs" wrap="wrap">
            {row.approvers.map((approver) => (
              <ApproverBadge key={approver.userId} department={row} approver={approver} />
            ))}
          </Group>
        ),
    },
    {
      key: 'add',
      header: 'Appoint',
      width: 340,
      render: (row) => <AppointControl department={row} />,
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="departments"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={APPROVER_FILTERS}
      />

      <DataTable
        label="Department approvers"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.teamId}
        isPending={departments.isPending}
        isError={departments.isError}
        isFetching={departments.isFetching}
        error={departments.error}
        onRetry={() => departments.refetch()}
        minWidth={880}
        isFiltered={isFiltered}
        noResults={
          <EmptyState
            title="No departments match those filters"
            description="Clear them to see every department."
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
            description="Create a department first, then appoint who decides its requests."
          />
        }
      />
    </Stack>
  )
}
