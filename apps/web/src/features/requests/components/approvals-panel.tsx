'use client'

import { Badge, Button, Group, Modal, Stack, Text } from '@mantine/core'
import Link from 'next/link'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { requestRoute } from '@/lib/routes'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
// Departments are organization data; the requests feature is a consumer of them.
import { useTeams } from '@/features/organization/hooks/use-teams'
import {
  DEFAULT_REQUEST_QUERY,
  REQUEST_STATUS_COLORS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_OPTIONS,
  requestQuerySchema,
  type RequestQuery,
  type RequestRow,
} from '../schema'
import { useDecideRequest, useRequestQueue } from '../hooks/use-requests'
import { DecisionFields } from './decision-fields'
import { RequestAnswers } from './request-answers'

const submitted = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const PAGE_SIZE = 25

const parseRequestQuery = searchParamsParser(requestQuerySchema, ['teamIds'])

export function ApprovalsPanel() {
  const {
    query: listQuery,
    setQuery,
    clearFilters,
  } = useUrlQuery(parseRequestQuery, DEFAULT_REQUEST_QUERY)
  const teams = useTeams()

  // The server does the filtering and the paging; pageSize is fixed rather than URL state.
  const query: RequestQuery = {
    status: listQuery.status,
    search: listQuery.search.trim(),
    teamIds: listQuery.teamIds,
    page: listQuery.page,
    pageSize: PAGE_SIZE,
  }

  const filters: readonly FilterControl[] = [
    { kind: 'select', key: 'status', label: 'Status', options: REQUEST_STATUS_OPTIONS },
    {
      kind: 'multi',
      key: 'teamIds',
      label: 'Department',
      options: (teams.data ?? []).map((team) => ({ value: team.id, label: team.name })),
    },
  ]

  const isFiltered =
    query.search.length > 0 || query.status !== 'pending' || query.teamIds.length > 0

  const queue = useRequestQueue(query)
  const decide = useDecideRequest(query)
  const [deciding, setDeciding] = useState<RequestRow | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const columns: DataTableColumn<RequestRow>[] = [
    {
      key: 'form',
      header: 'Request',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Link href={requestRoute(row.id)}>{row.formName}</Link>
          <Text size="xs" c="dimmed">
            {row.requesterName} · {submitted.format(new Date(row.createdAt))}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'team',
      header: 'Department',
      render: (row) => <Text size="sm">{row.teamName ?? '—'}</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      render: (row) => (
        <Badge color={REQUEST_STATUS_COLORS[row.status]} variant="light">
          {REQUEST_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 260,
      align: 'right',
      render: (row) => (
        <Group gap="xs" justify="flex-end" wrap="nowrap">
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            aria-label={`${expanded === row.id ? 'Hide' : 'Show'} the answers on ${row.requesterName}'s ${row.formName} request`}
            aria-expanded={expanded === row.id}
            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
          >
            Answers
          </Button>
          {row.canDecide ? (
            <Button
              variant="subtle"
              size="compact-sm"
              aria-label={`Approve or reject ${row.requesterName}'s ${row.formName} request`}
              onClick={() => setDeciding(row)}
            >
              Approve or reject
            </Button>
          ) : (
            // A cell with no control and no reason reads as a bug; say which rule applies.
            <Text size="sm" c="dimmed">
              {whyNotDecidable(row)}
            </Text>
          )}
        </Group>
      ),
    },
  ]

  const openRow = queue.data?.rows.find((row) => row.id === expanded)

  return (
    <Stack gap="md">
      <TableToolbar
        label="requests"
        query={listQuery}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={filters}
      />

      <DataTable
        label="Requests"
        columns={columns}
        rows={queue.data?.rows}
        rowKey={(row) => row.id}
        isPending={queue.isPending}
        isError={queue.isError}
        isFetching={queue.isFetching}
        error={queue.error}
        onRetry={() => queue.refetch()}
        minWidth={820}
        pageInfo={queue.data?.pageInfo}
        onPageChange={(page) => setQuery({ page })}
        isFiltered={isFiltered}
        noResults={
          <EmptyState
            title="Nothing matches those filters"
            description="Clear them to see the whole queue."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
        empty={
          <EmptyState
            title="Nothing waiting on you"
            description="Requests raised in the departments you approve for land here."
          />
        }
      />

      {openRow ? (
        <Stack
          gap="xs"
          p="md"
          bd="1px solid var(--mantine-color-default-border)"
          style={{ borderRadius: 'var(--mantine-radius-md)' }}
        >
          <Text fw={600} size="sm">
            {openRow.formName} · {openRow.requesterName}
          </Text>
          <RequestAnswers fields={openRow.fields} values={openRow.values} />
        </Stack>
      ) : null}

      <Modal
        opened={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        centered
        title={deciding ? `${deciding.formName} from ${deciding.requesterName}` : 'Decide request'}
      >
        {deciding ? (
          <Stack gap="md">
            <RequestAnswers fields={deciding.fields} values={deciding.values} />
            <DecisionFields
              label="request"
              isPending={decide.isPending}
              onCancel={() => setDeciding(null)}
              onDecide={(decision, note) => {
                decide.mutate({ submissionId: deciding.id, decision, note })
                setDeciding(null)
              }}
            />
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  )
}

/**
 * Why a row offers no decision. The rules live in canDecide() on the server; this only has to
 * name the one that applies, so an empty Actions cell is never mistaken for a broken table.
 */
function whyNotDecidable(row: RequestRow) {
  if (row.status !== 'pending') return 'Already decided'
  // Separation of duties: nobody decides their own request, whatever their role.
  if (row.isMine) return 'Your own request'
  return 'Not your department'
}
