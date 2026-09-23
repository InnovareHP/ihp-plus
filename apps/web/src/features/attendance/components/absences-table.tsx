'use client'

import { Badge, Stack, Text, Title } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import type { AttendanceAbsenceRow } from '../schema'

export interface AbsencesTableProps {
  absences: readonly AttendanceAbsenceRow[] | undefined
  isPending: boolean
  isError: boolean
  isFetching: boolean
  onRetry: () => void
  showPerson?: boolean
}

// UTC because the key is a calendar date, and any other zone could print the day before.
const dayLabel = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString([], {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

/** The scheduled days nobody clocked: leave where it was approved, absent where it was not. */
export function AbsencesTable({
  absences,
  isPending,
  isError,
  isFetching,
  onRetry,
  showPerson = false,
}: AbsencesTableProps) {
  const absent = absences?.filter((row) => row.kind === 'absent').length ?? 0
  const leave = (absences?.length ?? 0) - absent

  const columns: DataTableColumn<AttendanceAbsenceRow>[] = [
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
    ...(showPerson
      ? [
          {
            key: 'person',
            header: 'Employee',
            render: (row: AttendanceAbsenceRow) => <Text size="sm">{row.userName}</Text>,
          },
        ]
      : []),
    {
      key: 'kind',
      header: 'Reason',
      render: (row) =>
        row.kind === 'leave' ? (
          <Badge color="cyan" variant="light">
            {row.leaveName ? `On leave: ${row.leaveName}` : 'On leave'}
          </Badge>
        ) : (
          <Badge color="red" variant="light">
            Absent
          </Badge>
        ),
    },
  ]

  return (
    <Stack gap="xs" component="section" aria-labelledby="absences-heading">
      <Stack gap={2}>
        <Title order={3} size="h6" id="absences-heading">
          Days not clocked
        </Title>
        <Text size="xs" c="dimmed">
          {absences
            ? `${absent} absent, ${leave} on leave. Holidays, days outside a shift and today are not counted.`
            : 'Holidays, days outside a shift and today are not counted.'}
        </Text>
      </Stack>
      <DataTable
        label="Days not clocked"
        columns={columns}
        rows={absences}
        rowKey={(row) => `${row.userId}-${row.workDate}`}
        isPending={isPending}
        isError={isError}
        isFetching={isFetching}
        onRetry={onRetry}
        errorTitle="Could not load absences"
        minWidth={420}
        empty={
          <EmptyState
            title="No missed days"
            description="Every scheduled day in this range has a clock-in."
          />
        }
      />
    </Stack>
  )
}
