'use client'

import { Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import type { AttendanceDayRow } from '../schema'
import { formatHours, formatTimeOfDay } from '@ihp/clock'
import { AttendanceStatusBadge } from './attendance-status-badge'
import { SelfieLinks } from './selfie-links'

export interface AttendanceLogTableProps {
  days: readonly AttendanceDayRow[] | undefined
  isPending: boolean
  isError: boolean
  isFetching: boolean
  onRetry: () => void
  /** Shown only where the viewer may act on somebody's day. */
  actions?: (day: AttendanceDayRow) => ReactNode
  showPerson?: boolean
  emptyHint: string
  /** Times are read in the organization's zone, never the reader's own. */
  timeZone: string
}

const dayLabel = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString([], {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

/** The log both halves of the feature read: a member's own days, or everyone's. */
export function AttendanceLogTable({
  days,
  isPending,
  isError,
  isFetching,
  onRetry,
  actions,
  showPerson = false,
  emptyHint,
  timeZone,
}: AttendanceLogTableProps) {
  const columns: DataTableColumn<AttendanceDayRow>[] = [
    {
      key: 'workDate',
      header: 'Day',
      rowHeader: true,
      render: (day) => (
        <Text size="sm" fw={500}>
          {dayLabel(day.workDate)}
        </Text>
      ),
    },
    ...(showPerson
      ? [
          {
            key: 'person',
            header: 'Employee',
            render: (day: AttendanceDayRow) => <Text size="sm">{day.userName}</Text>,
          },
        ]
      : []),
    { key: 'in', header: 'In', render: (day) => formatTimeOfDay(day.clockInAt, timeZone) },
    { key: 'out', header: 'Out', render: (day) => formatTimeOfDay(day.clockOutAt, timeZone) },
    {
      key: 'worked',
      header: 'Worked',
      align: 'right',
      render: (day) => formatHours(day.workedSeconds),
    },
    {
      key: 'break',
      header: 'Breaks',
      align: 'right',
      render: (day) => formatHours(day.breakSeconds),
    },
    {
      key: 'late',
      header: 'Late',
      align: 'right',
      render: (day) =>
        day.lateSeconds > 0 ? (
          <Text size="sm" c="red">
            {formatHours(day.lateSeconds)}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            On time
          </Text>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (day) => <AttendanceStatusBadge day={day} />,
    },
    {
      key: 'selfies',
      header: 'Photos',
      render: (day) => <SelfieLinks day={day} />,
    },
    ...(actions
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            width: 90,
            render: (day: AttendanceDayRow) => actions(day),
          },
        ]
      : []),
  ]

  return (
    <DataTable
      label="Attendance"
      columns={columns}
      rows={days}
      rowKey={(day) => day.id}
      isPending={isPending}
      isError={isError}
      isFetching={isFetching}
      onRetry={onRetry}
      errorTitle="Could not load attendance"
      minWidth={880}
      stickyHeader
      empty={<EmptyState title="No days here yet" description={emptyHint} />}
    />
  )
}
