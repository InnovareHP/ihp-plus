'use client'

import { Button, Card, Group, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { StatCard } from '@/components/stat-card'
import { useAttendanceBoard } from '../hooks/use-attendance-admin'
import { useAttendanceRange } from '../hooks/use-attendance-range'
import type { AttendanceBoardRow } from '../schema'
import { formatHours, formatTimeOfDay } from '../utils/clock'
import { AttendanceDayModal } from './attendance-day-modal'
import { ClockStateBadge } from './clock-state-badge'

export interface AttendanceBoardPanelProps {
  timeZone: string
}

/** Who is in, who is late, who never showed — the screen an admin keeps open. */
export function AttendanceBoardPanel({ timeZone }: AttendanceBoardPanelProps) {
  const range = useAttendanceRange()
  const board = useAttendanceBoard(range.to)
  const [editing, setEditing] = useState<AttendanceBoardRow | undefined>(undefined)

  const columns: DataTableColumn<AttendanceBoardRow>[] = [
    {
      key: 'person',
      header: 'Employee',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.userName}
          </Text>
          {row.jobTitle ? (
            <Text size="xs" c="dimmed">
              {row.jobTitle}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    { key: 'state', header: 'State', render: (row) => <ClockStateBadge state={row.state} /> },
    { key: 'in', header: 'In', render: (row) => formatTimeOfDay(row.day?.clockInAt, timeZone) },
    {
      key: 'out',
      header: 'Out',
      render: (row) => formatTimeOfDay(row.day?.clockOutAt, timeZone),
    },
    {
      key: 'worked',
      header: 'Worked',
      align: 'right',
      render: (row) => (row.day ? formatHours(row.day.workedSeconds) : '—'),
    },
    {
      key: 'late',
      header: 'Late',
      align: 'right',
      render: (row) =>
        row.day && row.day.lateSeconds > 0 ? (
          <Text size="sm" c="red">
            {formatHours(row.day.lateSeconds)}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <Button
          variant="subtle"
          size="compact-sm"
          onClick={() => setEditing(row)}
          aria-label={`Correct ${row.userName}'s day`}
        >
          {row.day ? 'Correct' : 'Add day'}
        </Button>
      ),
    },
  ]

  return (
    <Card padding="lg" component="section" aria-labelledby="attendance-board-heading">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={2}>
            <Title order={2} size="h5" id="attendance-board-heading">
              Who is in
            </Title>
            <Text size="xs" c="dimmed">
              Times are shown in the company zone, {timeZone}.
            </Text>
          </Stack>
          <TextInput
            type="date"
            label="Day"
            value={range.to}
            onChange={(event) => range.setRange({ to: event.currentTarget.value })}
          />
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <StatCard
            label="Present"
            value={board.data?.presentCount ?? 0}
            hint="Clocked in at some point today"
          />
          <StatCard
            label="Late"
            value={board.data?.lateCount ?? 0}
            hint="Past their shift start and its grace"
          />
          <StatCard
            label="Absent"
            value={board.data?.absentCount ?? 0}
            hint="No clock in on this day"
          />
        </SimpleGrid>

        <DataTable
          label="Attendance board"
          columns={columns}
          rows={board.data?.rows}
          rowKey={(row) => row.userId}
          isPending={board.isPending}
          isError={board.isError}
          isFetching={board.isFetching}
          onRetry={() => void board.refetch()}
          errorTitle="Could not load the board"
          minWidth={760}
          stickyHeader
          empty={
            <EmptyState
              title="Nobody to show"
              description="Invite people to the organization and their day appears here."
            />
          }
        />

        {editing ? (
          <AttendanceDayModal
            opened
            onClose={() => setEditing(undefined)}
            person={{ userId: editing.userId, userName: editing.userName }}
            workDate={board.data?.date ?? range.to}
            timeZone={timeZone}
            day={editing.day}
          />
        ) : null}
      </Stack>
    </Card>
  )
}
