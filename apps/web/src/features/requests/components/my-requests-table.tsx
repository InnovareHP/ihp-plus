'use client'

import { Badge, Button, Stack, Text } from '@mantine/core'
import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { requestRoute } from '@/lib/routes'
import { useMyRequests, useWithdrawRequest } from '../hooks/use-requests'
import {
  REQUEST_STATUS_COLORS,
  REQUEST_STATUS_LABELS,
  type MyRequestQuery,
  type RequestRow,
} from '../schema'

const submitted = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function MyRequestsTable({
  query,
  setQuery,
  clearFilters,
}: {
  query: MyRequestQuery
  setQuery: (patch: Partial<MyRequestQuery>) => void
  clearFilters: () => void
}) {
  const requests = useMyRequests(query)
  const withdraw = useWithdrawRequest()

  const isFiltered = query.search.length > 0 || query.status !== 'all'

  const columns: DataTableColumn<RequestRow>[] = [
    {
      key: 'form',
      header: 'Request',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Link href={requestRoute(row.id)}>{row.formName}</Link>
          <Text size="xs" c="dimmed">
            {submitted.format(new Date(row.createdAt))}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 140,
      render: (row) => (
        <Badge color={REQUEST_STATUS_COLORS[row.status]} variant="light">
          {REQUEST_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'decision',
      header: 'Decision',
      render: (row) => (
        <Text size="sm" c="dimmed" lineClamp={2}>
          {row.decisionNote || (row.decidedBy ? `Decided by ${row.decidedBy}` : '—')}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 130,
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <Button
            variant="subtle"
            color="red"
            size="compact-sm"
            aria-label={`Withdraw your ${row.formName} request`}
            onClick={() => withdraw.mutate({ submissionId: row.id })}
          >
            Withdraw
          </Button>
        ) : null,
    },
  ]

  return (
    <DataTable
      label="Your requests"
      columns={columns}
      rows={requests.data?.rows}
      rowKey={(row) => row.id}
      pageInfo={requests.data?.pageInfo}
      onPageChange={(page) => setQuery({ page })}
      onPageSizeChange={(pageSize) => setQuery({ pageSize, page: 1 })}
      isPending={requests.isPending}
      isError={requests.isError}
      isFetching={requests.isFetching}
      error={requests.error}
      onRetry={() => requests.refetch()}
      minWidth={680}
      isFiltered={isFiltered}
      noResults={
        <EmptyState
          title="Nothing matches those filters"
          description="Clear them to see everything you have sent."
          action={
            <Button variant="default" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      }
      empty={
        <EmptyState
          title="You have not raised a request yet"
          description="Pick a form above and your request appears here with its progress."
        />
      }
    />
  )
}
