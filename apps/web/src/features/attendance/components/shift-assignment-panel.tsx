'use client'

import { Badge, Card, Group, Select, Stack, Text, Title } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { LinkAnchor } from '@/components/link-anchor'
import { routes } from '@/lib/routes'
import { useAssignShift, useSchedules } from '../hooks/use-attendance-admin'
import type { AttendanceScheduleRow } from '../schema'
import { formatWorkdays, minutesToClock } from '../utils/clock'

const COMPANY_HOURS = ''

/** Who works which shift. The shifts themselves are written in the time clock. */
export function ShiftAssignmentPanel() {
  const book = useSchedules()
  const assign = useAssignShift()

  const options = [
    { value: COMPANY_HOURS, label: 'Company hours' },
    ...(book.data?.shifts ?? []).map((shift) => ({
      value: shift.id,
      label: `${shift.name} · ${minutesToClock(shift.shiftStartMinutes)}–${minutesToClock(shift.shiftEndMinutes)}`,
    })),
  ]

  const columns: DataTableColumn<AttendanceScheduleRow>[] = [
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
    {
      key: 'shift',
      header: 'Shift',
      width: 280,
      render: (row) => (
        <Select
          data={options}
          value={row.shiftId ?? COMPANY_HOURS}
          onChange={(value) =>
            assign.mutate({ userId: row.userId, shiftId: value ?? COMPANY_HOURS })
          }
          aria-label={`Shift for ${row.userName}`}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
          size="sm"
        />
      ),
    },
    {
      key: 'hours',
      header: 'Works',
      render: (row) => (
        <Group gap="xs" wrap="nowrap">
          <Text size="sm">
            {minutesToClock(row.shiftStartMinutes)}–{minutesToClock(row.shiftEndMinutes)}
          </Text>
          {row.isDefault ? (
            <Badge variant="light" color="gray">
              Company hours
            </Badge>
          ) : null}
        </Group>
      ),
    },
    { key: 'days', header: 'Days', render: (row) => formatWorkdays(row.workdays) },
    { key: 'grace', header: 'Grace', align: 'right', render: (row) => `${row.graceMinutes} min` },
  ]

  return (
    <Card padding="lg" component="section" aria-labelledby="shift-assignment-heading">
      <Stack gap="md">
        <Stack gap={2}>
          <Title order={2} size="h5" id="shift-assignment-heading">
            Shifts
          </Title>
          <Text size="sm" c="dimmed">
            Which hours each person is measured against. Write the shifts themselves under{' '}
            <LinkAnchor href={`${routes.attendanceTeam}?tab=shifts`} size="sm">
              Time clock → Shifts
            </LinkAnchor>
            .
          </Text>
        </Stack>

        <DataTable
          label="Shift assignments"
          columns={columns}
          rows={book.data?.schedules}
          rowKey={(row) => row.userId}
          isPending={book.isPending}
          isError={book.isError}
          isFetching={book.isFetching}
          onRetry={() => void book.refetch()}
          errorTitle="Could not load shift assignments"
          minWidth={860}
          stickyHeader
          empty={
            <EmptyState
              title="Nobody to schedule"
              description="Invite people to the organization and their shift appears here."
            />
          }
        />
      </Stack>
    </Card>
  )
}
