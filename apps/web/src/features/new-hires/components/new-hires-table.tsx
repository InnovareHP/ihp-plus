'use client'

import { Badge, Button, Group, Menu, Progress, Stack, Text } from '@mantine/core'
import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { organizationTab } from '@/lib/routes'
import { offerUndo } from '@/lib/undo'
import { useClientPagination } from '@/lib/use-client-pagination'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { useCloseChecklist, useNewHires } from '../hooks/use-new-hires'
import {
  CHECKLIST_STEPS,
  DEFAULT_NEW_HIRE_QUERY,
  newHireQuerySchema,
  STEP_LABELS,
  STEP_OWNERS,
  type NewHireQuery,
  type NewHireRow,
} from '../schema'
import { StepBadges } from './step-badges'

const started = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

const parseNewHireQuery = searchParamsParser(newHireQuerySchema)

const FILTERS: readonly FilterControl[] = [
  {
    kind: 'select',
    key: 'status',
    label: 'Checklist',
    options: [
      { value: 'open', label: 'Still settling in' },
      { value: 'completed', label: 'Finished' },
      { value: 'all', label: 'Everyone' },
    ],
  },
  {
    kind: 'select',
    key: 'stuckOn',
    label: 'Stuck on',
    help: 'The first step each hire has not finished.',
    options: CHECKLIST_STEPS.map((step) => ({ value: step, label: STEP_LABELS[step] })),
  },
]

function matches(row: NewHireRow, query: NewHireQuery, term: string) {
  if (query.status === 'open' && row.completedAt) return false
  if (query.status === 'completed' && !row.completedAt) return false
  if (query.stuckOn && row.stuckOn !== query.stuckOn) return false
  if (!term) return true
  return [row.name, row.teamName ?? '', row.jobTitle ?? ''].some((value) =>
    value.toLowerCase().includes(term),
  )
}

/** Who is still settling in and the step each one is stuck on. */
export function NewHiresTable() {
  const hires = useNewHires()
  const close = useCloseChecklist()
  const { query, setQuery, clearFilters } = useUrlQuery(parseNewHireQuery, DEFAULT_NEW_HIRE_QUERY)

  const term = query.search.trim().toLowerCase()
  const rows = hires.data?.filter((row) => matches(row, query, term))
  const paged = useClientPagination(rows)
  const isFiltered = term.length > 0 || query.status !== 'open' || query.stuckOn !== ''

  // Undo over confirm: the row closes at once, and the server hears only when the toast goes.
  function closeWithUndo(row: NewHireRow) {
    const previous = close.applyClose(row.userId)
    offerUndo({
      message: `Closed ${row.name}'s checklist`,
      undoLabel: 'Undo',
      onUndo: () => close.restore(previous),
      onCommit: () => close.commit.mutate({ userId: row.userId, previous }),
    })
  }

  const columns: DataTableColumn<NewHireRow>[] = [
    {
      key: 'name',
      header: 'New hire',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed">
            {[row.jobTitle, row.teamName].filter(Boolean).join(' · ') || 'No department'}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'startedAt',
      header: 'Started',
      width: 130,
      render: (row) => <Text size="sm">{started.format(new Date(row.startedAt))}</Text>,
    },
    {
      key: 'progress',
      header: 'Progress',
      width: 150,
      render: (row) => (
        <Stack gap={4}>
          <Text size="xs">
            {row.doneCount} of {CHECKLIST_STEPS.length} steps
          </Text>
          <Progress
            value={(row.doneCount / CHECKLIST_STEPS.length) * 100}
            size="sm"
            color={row.completedAt ? 'green' : 'brand'}
            aria-label={`${row.name}: ${row.doneCount} of ${CHECKLIST_STEPS.length} steps done`}
          />
        </Stack>
      ),
    },
    {
      key: 'stuckOn',
      header: 'Stuck on',
      width: 190,
      render: (row) =>
        row.completedAt ? (
          <Badge color="green" variant="light">
            {row.closedByAdmin ? 'Closed by an admin' : 'Finished'}
          </Badge>
        ) : row.stuckOn ? (
          <Stack gap={2} align="flex-start">
            <Badge
              color={STEP_OWNERS[row.stuckOn] === 'admin' ? 'orange' : 'brand'}
              variant="light"
            >
              {STEP_LABELS[row.stuckOn]}
            </Badge>
            <Text size="xs" c="dimmed">
              {STEP_OWNERS[row.stuckOn] === 'admin' ? 'Waiting on an admin' : 'Waiting on them'}
            </Text>
          </Stack>
        ) : null,
    },
    {
      key: 'steps',
      header: 'Steps',
      render: (row) => <StepBadges progress={row.progress} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 90,
      align: 'right',
      render: (row) =>
        row.completedAt ? null : (
          <RowActionsMenu name={row.name}>
            {row.progress.shift.done ? null : (
              <Menu.Item
                component={Link}
                href={`${organizationTab('members')}&search=${encodeURIComponent(row.name)}`}
              >
                Assign a shift
              </Menu.Item>
            )}
            <Menu.Item onClick={() => closeWithUndo(row)}>Close checklist</Menu.Item>
          </RowActionsMenu>
        ),
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="new hires"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={FILTERS}
      />

      <DataTable
        label="New hires"
        columns={columns}
        rows={paged.rows}
        pageInfo={paged.pageInfo}
        onPageChange={paged.onPageChange}
        onPageSizeChange={paged.onPageSizeChange}
        rowKey={(row) => row.userId}
        isPending={hires.isPending}
        isError={hires.isError}
        isFetching={hires.isFetching}
        error={hires.error}
        errorTitle="Could not load new hires"
        onRetry={() => void hires.refetch()}
        minWidth={960}
        isFiltered={isFiltered}
        noResults={
          <EmptyState
            title="Nobody matches those filters"
            description="Clear them to see everyone still settling in."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
        empty={
          <EmptyState
            title="No new hires yet"
            description="Anyone who finishes setting up their account from now on appears here with their checklist."
          />
        }
      />
      <Group justify="flex-end">
        <Text size="xs" c="dimmed">
          A checklist closes by itself once every step is done.
        </Text>
      </Group>
    </Stack>
  )
}
