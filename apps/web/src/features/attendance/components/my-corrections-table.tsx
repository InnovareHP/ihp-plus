'use client'

import { Button, Stack, Text, Title } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import type { AttendanceCorrectionRow } from '../schema'
import { CorrectionStatusBadge } from './correction-status-badge'

export interface MyCorrectionsTableProps {
  corrections: readonly AttendanceCorrectionRow[] | undefined
  isPending: boolean
  isError: boolean
  isFetching: boolean
  onRetry: () => void
  onWithdraw: (correction: AttendanceCorrectionRow) => void
}

// UTC because the key is a calendar date, and any other zone could print the day before.
const dayLabel = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString([], {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

/** A member's own correction requests and where each one stands. */
export function MyCorrectionsTable({
  corrections,
  isPending,
  isError,
  isFetching,
  onRetry,
  onWithdraw,
}: MyCorrectionsTableProps) {
  const columns: DataTableColumn<AttendanceCorrectionRow>[] = [
    {
      key: 'workDate',
      header: 'Day',
      rowHeader: true,
      render: (row) => (
        <Text size="sm" fw={500}>
          {dayLabel(row.workDate)}
        </Text>
      ),
    },
    {
      key: 'asked',
      header: 'Asked for',
      render: (row) =>
        `${row.clockInTime}–${row.clockOutTime}${row.breakMinutes > 0 ? `, ${row.breakMinutes} min break` : ''}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Stack gap={2} align="flex-start">
          <CorrectionStatusBadge status={row.status} />
          {row.decisionNote ? (
            <Text size="xs" c="dimmed">
              {row.decidedBy ? `${row.decidedBy}: ` : ''}
              {row.decisionNote}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            // A row still being saved has no server id to withdraw yet.
            disabled={row.id.startsWith('pending-')}
            onClick={() => onWithdraw(row)}
            aria-label={`Withdraw the request for ${dayLabel(row.workDate)}`}
          >
            Withdraw
          </Button>
        ) : null,
    },
  ]

  return (
    <Stack gap="xs" component="section" aria-labelledby="my-corrections-heading">
      <Title order={3} size="h6" id="my-corrections-heading">
        Your correction requests
      </Title>
      <DataTable
        label="Your correction requests"
        columns={columns}
        rows={corrections}
        rowKey={(row) => row.id}
        isPending={isPending}
        isError={isError}
        isFetching={isFetching}
        onRetry={onRetry}
        errorTitle="Could not load your requests"
        minWidth={560}
        empty={
          <EmptyState
            title="No requests yet"
            description="If a day is wrong, such as a missed clock-out, ask for a correction and an admin puts it right."
          />
        }
      />
    </Stack>
  )
}
