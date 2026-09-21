'use client'

import { Badge, Button, Group, Stack, Text } from '@mantine/core'
import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { evaluationRoute, fillEvaluationRoute } from '@/lib/routes'
import { useMyEvaluations } from '../hooks/use-evaluations'
import {
  EVALUATION_STATUS_COLORS,
  EVALUATION_STATUS_LABELS,
  isOverdue,
  type EvaluationRow,
  type MyEvaluationQuery,
} from '../schema'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

export function MyEvaluationsTable({
  query,
  setQuery,
  clearFilters,
}: {
  query: MyEvaluationQuery
  setQuery: (patch: Partial<MyEvaluationQuery>) => void
  clearFilters: () => void
}) {
  const evaluations = useMyEvaluations(query)

  const isFiltered = query.search.length > 0 || query.status !== 'pending'

  const columns: DataTableColumn<EvaluationRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.employeeName}
          </Text>
          <Text size="xs" c="dimmed">
            {row.employeeTeam ?? 'No department'}
            {row.employeeEmploymentStatus ? ` · ${row.employeeEmploymentStatus}` : ''}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'form',
      header: 'Evaluation',
      render: (row) => <Text size="sm">{row.formName}</Text>,
    },
    {
      key: 'due',
      header: 'Due',
      width: 170,
      render: (row) =>
        row.dueAt ? (
          <Group gap="xs" wrap="nowrap">
            <Text size="sm">{dateOnly.format(new Date(row.dueAt))}</Text>
            {/* Colour alone would not carry it, so the word is there too. */}
            {isOverdue(row) ? (
              <Badge color="red" variant="light" size="sm">
                Overdue
              </Badge>
            ) : null}
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            No due date
          </Text>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      render: (row) => (
        <Badge color={EVALUATION_STATUS_COLORS[row.status]} variant="light">
          {EVALUATION_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 150,
      align: 'right',
      render: (row) =>
        row.canFill ? (
          <Button
            component={Link}
            href={fillEvaluationRoute(row.id)}
            variant="light"
            size="compact-sm"
            aria-label={`Fill in the ${row.formName} for ${row.employeeName}`}
          >
            Fill it in
          </Button>
        ) : row.status === 'submitted' ? (
          <Button
            component={Link}
            href={evaluationRoute(row.id)}
            variant="subtle"
            size="compact-sm"
            aria-label={`Read your ${row.formName} for ${row.employeeName}`}
          >
            Read it
          </Button>
        ) : null,
    },
  ]

  return (
    <DataTable
      label="Your evaluations"
      columns={columns}
      rows={evaluations.data?.rows}
      rowKey={(row) => row.id}
      pageInfo={evaluations.data?.pageInfo}
      onPageChange={(page) => setQuery({ page })}
      onPageSizeChange={(pageSize) => setQuery({ pageSize, page: 1 })}
      isPending={evaluations.isPending}
      isError={evaluations.isError}
      isFetching={evaluations.isFetching}
      error={evaluations.error}
      errorTitle="Could not load your evaluations"
      onRetry={() => evaluations.refetch()}
      minWidth={760}
      isFiltered={isFiltered}
      noResults={
        <EmptyState
          title="Nothing matches those filters"
          description="Clear them to see every evaluation you have been asked for."
          action={
            <Button variant="default" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      }
      empty={
        <EmptyState
          title="Nothing to evaluate right now"
          description="When People & Culture asks you to evaluate someone, it appears here."
        />
      }
    />
  )
}
