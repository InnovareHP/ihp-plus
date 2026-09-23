'use client'

import { Badge, Button, Card, Group, Menu, Stack, Text, Title } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { useDeleteShift, useShifts } from '../hooks/use-attendance-admin'
import { DEFAULT_SHIFT, type AttendanceShiftRow } from '../schema'
import { formatWorkdays, minutesToClock } from '@ihp/clock'
import { ShiftModal } from './shift-modal'
import { ShiftRules } from './shift-rules'

/** The shift library: written here, given to people under the organization. */
export function ShiftsPanel() {
  const book = useShifts()
  const remove = useDeleteShift()
  const [editing, setEditing] = useState<AttendanceShiftRow | undefined>(undefined)
  const [writing, setWriting] = useState(false)
  const companyHours = book.data?.shifts.find((shift) => shift.isDefault) ?? DEFAULT_SHIFT

  const columns: DataTableColumn<AttendanceShiftRow>[] = [
    {
      key: 'name',
      header: 'Shift',
      rowHeader: true,
      render: (row) => (
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={500}>
            {row.name}
          </Text>
          {row.isDefault ? (
            <Badge variant="light" color="gray">
              Company hours
            </Badge>
          ) : null}
        </Group>
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
      key: 'rules',
      header: 'Asks for',
      render: (row) => <ShiftRules shift={row} />,
    },
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
      width: 90,
      render: (row) => (
        <RowActionsMenu
          name={row.name}
          loading={remove.isPending && remove.variables?.shiftId === row.id}
        >
          <Menu.Item onClick={() => setEditing(row)}>Edit</Menu.Item>
          <Menu.Item color="red" onClick={() => remove.mutate({ shiftId: row.id })}>
            Delete
          </Menu.Item>
        </RowActionsMenu>
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
              A shift decides what counts as late. Give one to a person on their row under
              Organization → Members; anyone without one works the company hours in Settings.
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
              description="Write the hours your people actually work, then give them out on the members table."
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
            defaults={companyHours}
          />
        ) : null}
      </Stack>
    </Card>
  )
}
