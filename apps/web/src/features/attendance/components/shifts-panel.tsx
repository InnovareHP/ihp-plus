'use client'

import { Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { useDeleteShift, useShifts } from '../hooks/use-attendance-admin'
import { DEFAULT_ATTENDANCE_SETTINGS, type AttendanceShiftRow } from '../schema'
import { formatWorkdays, minutesToClock } from '../utils/clock'
import { ShiftModal } from './shift-modal'

/** The shift library: written here, given to people under the organization. */
export function ShiftsPanel() {
  const book = useShifts()
  const remove = useDeleteShift()
  const [editing, setEditing] = useState<AttendanceShiftRow | undefined>(undefined)
  const [writing, setWriting] = useState(false)
  const settings = book.data?.settings ?? DEFAULT_ATTENDANCE_SETTINGS

  const columns: DataTableColumn<AttendanceShiftRow>[] = [
    {
      key: 'name',
      header: 'Shift',
      rowHeader: true,
      render: (row) => (
        <Text size="sm" fw={500}>
          {row.name}
        </Text>
      ),
    },
    {
      key: 'hours',
      header: 'Hours',
      render: (row) =>
        `${minutesToClock(row.shiftStartMinutes)}–${minutesToClock(row.shiftEndMinutes)}`,
    },
    { key: 'grace', header: 'Grace', align: 'right', render: (row) => `${row.graceMinutes} min` },
    { key: 'days', header: 'Days', render: (row) => formatWorkdays(row.workdays) },
    {
      key: 'assigned',
      header: 'People',
      align: 'right',
      render: (row) => (row.assignedCount === 0 ? 'Nobody yet' : String(row.assignedCount)),
    },
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
            aria-label={`Edit ${row.name}`}
          >
            Edit
          </Button>
          <Button
            variant="subtle"
            color="red"
            size="compact-sm"
            loading={remove.isPending}
            onClick={() => remove.mutate({ shiftId: row.id })}
            aria-label={`Delete ${row.name}`}
          >
            Delete
          </Button>
        </Group>
      ),
    },
  ]

  return (
    <Card padding="lg" component="section" aria-labelledby="shifts-heading">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={2}>
            <Title order={2} size="h5" id="shifts-heading">
              Shifts
            </Title>
            <Text size="sm" c="dimmed">
              A shift decides what counts as late. Give one to a person under Organization → Shifts;
              anyone without one works the company hours in Settings.
            </Text>
          </Stack>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setWriting(true)}>
            New shift
          </Button>
        </Group>

        <DataTable
          label="Shifts"
          columns={columns}
          rows={book.data?.shifts}
          rowKey={(row) => row.id}
          isPending={book.isPending}
          isError={book.isError}
          isFetching={book.isFetching}
          onRetry={() => void book.refetch()}
          errorTitle="Could not load shifts"
          minWidth={720}
          stickyHeader
          empty={
            <EmptyState
              title="No shifts yet"
              description="Write the hours your people actually work, then hand them out under Organization."
              action={<Button onClick={() => setWriting(true)}>New shift</Button>}
            />
          }
        />

        {writing || editing ? (
          <ShiftModal
            opened
            onClose={() => {
              setWriting(false)
              setEditing(undefined)
            }}
            shift={editing}
            defaults={settings}
          />
        ) : null}
      </Stack>
    </Card>
  )
}
