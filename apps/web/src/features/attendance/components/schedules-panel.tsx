'use client'

import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { useClearSchedule, useSchedules } from '../hooks/use-attendance-admin'
import type { AttendanceScheduleRow } from '../schema'
import { formatWorkdays, minutesToClock } from '../utils/clock'
import { ScheduleModal } from './schedule-modal'

/** Who works when: everyone sits on the company shift until an admin gives them their own. */
export function SchedulesPanel() {
  const book = useSchedules()
  const clear = useClearSchedule()
  const [editing, setEditing] = useState<AttendanceScheduleRow | undefined>(undefined)

  const columns: DataTableColumn<AttendanceScheduleRow>[] = [
    {
      key: 'person',
      header: 'Employee',
      rowHeader: true,
      render: (row) => (
        <Group gap="xs">
          <Text size="sm" fw={500}>
            {row.userName}
          </Text>
          {row.isDefault ? (
            <Badge variant="light" color="gray">
              Company shift
            </Badge>
          ) : null}
        </Group>
      ),
    },
    {
      key: 'shift',
      header: 'Shift',
      render: (row) =>
        `${minutesToClock(row.shiftStartMinutes)}–${minutesToClock(row.shiftEndMinutes)}`,
    },
    { key: 'grace', header: 'Grace', align: 'right', render: (row) => `${row.graceMinutes} min` },
    { key: 'days', header: 'Days', render: (row) => formatWorkdays(row.workdays) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <Group gap="xs" justify="flex-end" wrap="nowrap">
          <Button
            variant="subtle"
            size="compact-sm"
            onClick={() => setEditing(row)}
            aria-label={`Set ${row.userName}'s shift`}
          >
            {row.isDefault ? 'Set shift' : 'Edit shift'}
          </Button>
          {row.isDefault ? null : (
            <Button
              variant="subtle"
              size="compact-sm"
              loading={clear.isPending}
              onClick={() => clear.mutate({ userId: row.userId })}
              aria-label={`Put ${row.userName} back on the company shift`}
            >
              Use company shift
            </Button>
          )}
        </Group>
      ),
    },
  ]

  return (
    <Card padding="lg" component="section" aria-labelledby="schedules-heading">
      <Stack gap="md">
        <Title order={2} size="h5" id="schedules-heading">
          Shifts
        </Title>
        <Text size="sm" c="dimmed">
          A shift decides what counts as late. Anyone without their own works the company hours in
          Settings.
        </Text>

        <DataTable
          label="Shifts"
          columns={columns}
          rows={book.data?.schedules}
          rowKey={(row) => row.userId}
          isPending={book.isPending}
          isError={book.isError}
          isFetching={book.isFetching}
          onRetry={() => void book.refetch()}
          errorTitle="Could not load shifts"
          minWidth={720}
          stickyHeader
          empty={
            <EmptyState
              title="Nobody to schedule"
              description="Invite people to the organization and their shift appears here."
            />
          }
        />

        {editing ? (
          <ScheduleModal opened onClose={() => setEditing(undefined)} schedule={editing} />
        ) : null}
      </Stack>
    </Card>
  )
}
