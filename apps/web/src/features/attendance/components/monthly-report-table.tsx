'use client'

import { Stack, Text } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { formatUsd } from '../utils/billing-statement'
import type { MonthlyReportRow } from '../utils/monthly-report'

export interface MonthlyReportTableProps {
  label: string
  rows: readonly MonthlyReportRow[]
}

const hours = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

const columns: DataTableColumn<MonthlyReportRow>[] = [
  {
    key: 'name',
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
  { key: 'days', header: 'Days', align: 'right', render: (row) => row.daysWorked },
  { key: 'hours', header: 'Hours', align: 'right', render: (row) => hours.format(row.hoursWorked) },
  {
    key: 'tasks',
    header: 'Tasks done',
    align: 'right',
    render: (row) => `${row.accomplished.length} of ${row.tasksPlanned}`,
  },
  {
    key: 'salary',
    header: 'Salary',
    align: 'right',
    render: (row) =>
      row.statementCount > 0 ? (
        <Text size="sm" fw={600}>
          {formatUsd(row.salaryCents)}
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          No statement
        </Text>
      ),
  },
]

/** One line per employee for the month: time, tasks accomplished and what they billed. */
export function MonthlyReportTable({ label, rows }: MonthlyReportTableProps) {
  return (
    <DataTable
      label={label}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.userId}
      isPending={false}
      empty={
        <EmptyState
          title="Nobody to report"
          description="Invite your team. They appear here once they clock in."
        />
      }
    />
  )
}
