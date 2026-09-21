'use client'

import { Badge, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { track } from '@/lib/analytics'
import { evaluationRoute } from '@/lib/routes'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
// Departments are organization data; the evaluations feature is a consumer of them.
import { useTeams } from '@/features/organization/hooks/use-teams'
import { evaluationEvents } from '../events'
import { useCancelEvaluation, useEvaluationTracker } from '../hooks/use-evaluations'
import {
  DEFAULT_EVALUATION_QUERY,
  EVALUATION_STATUS_COLORS,
  EVALUATION_STATUS_LABELS,
  EVALUATION_STATUS_OPTIONS,
  evaluationQuerySchema,
  isOverdue,
  type EvaluationListQuery,
  type EvaluationRow,
} from '../schema'
import { AssignEvaluationForm } from './assign-evaluation-form'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

const parseEvaluationQuery = searchParamsParser(evaluationQuerySchema, ['teamIds'])

export function EvaluationTracker() {
  const { query, setQuery, clearFilters } = useUrlQuery(
    parseEvaluationQuery,
    DEFAULT_EVALUATION_QUERY,
  )
  const teams = useTeams()
  const [assigning, setAssigning] = useState(false)

  // The server does the filtering and the paging; pageSize is fixed rather than URL state.
  const listQuery: EvaluationListQuery = { ...query, search: query.search.trim() }
  const tracker = useEvaluationTracker(listQuery)
  const cancel = useCancelEvaluation()

  const filters: readonly FilterControl[] = [
    { kind: 'select', key: 'status', label: 'Status', options: EVALUATION_STATUS_OPTIONS },
    {
      kind: 'multi',
      key: 'teamIds',
      label: 'Department',
      options: (teams.data ?? []).map((team) => ({ value: team.id, label: team.name })),
    },
  ]

  const isFiltered =
    listQuery.search.length > 0 || query.status !== 'pending' || query.teamIds.length > 0

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
      key: 'evaluator',
      header: 'Supervisor',
      render: (row) => <Text size="sm">{row.evaluatorName}</Text>,
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
      width: 180,
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <Button
            variant="subtle"
            color="red"
            size="compact-sm"
            aria-label={`Cancel the ${row.formName} for ${row.employeeName}`}
            onClick={() => cancel.mutate({ evaluationId: row.id })}
          >
            Cancel it
          </Button>
        ) : row.status === 'submitted' ? (
          <Button
            component={Link}
            href={evaluationRoute(row.id)}
            variant="subtle"
            size="compact-sm"
            aria-label={`Read the ${row.formName} for ${row.employeeName}`}
          >
            Read it
          </Button>
        ) : null,
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="evaluations"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={filters}
        action={
          <Button
            leftSection={<IconPlus size={16} aria-hidden />}
            onClick={() => {
              track(evaluationEvents.assignStarted)
              setAssigning(true)
            }}
          >
            Assign evaluation
          </Button>
        }
      />

      <DataTable
        label="Assigned evaluations"
        columns={columns}
        rows={tracker.data?.rows}
        rowKey={(row) => row.id}
        isPending={tracker.isPending}
        isError={tracker.isError}
        isFetching={tracker.isFetching}
        error={tracker.error}
        errorTitle="Could not load the evaluations"
        onRetry={() => tracker.refetch()}
        minWidth={900}
        pageInfo={tracker.data?.pageInfo}
        onPageChange={(page) => setQuery({ page })}
        onPageSizeChange={(pageSize) => setQuery({ pageSize, page: 1 })}
        isFiltered={isFiltered}
        noResults={
          <EmptyState
            title="Nothing matches those filters"
            description="Clear them to see every evaluation assigned in this organization."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
        empty={
          <EmptyState
            title="No evaluations assigned yet"
            description="Pick an evaluation form, the people it is about and the supervisor who fills it in."
            action={<Button onClick={() => setAssigning(true)}>Assign evaluation</Button>}
          />
        }
      />

      <Modal
        opened={assigning}
        onClose={() => setAssigning(false)}
        centered
        title="Assign an evaluation"
      >
        <AssignEvaluationForm onDone={() => setAssigning(false)} />
      </Modal>
    </Stack>
  )
}
