'use client'

import { Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { StatCard } from '@/components/stat-card'
import { useDailyTaskKpis } from '../hooks/use-attendance-admin'
import { useAttendanceRange } from '../hooks/use-attendance-range'
import type { DailyTaskKpiRow } from '../schema'
import { completionRate } from '../utils/daily-task-kpis'
import { AttendanceRangeFields } from './attendance-range-fields'

const rateLabel = (rate: number | undefined) => (rate === undefined ? '—' : `${rate}%`)

const columns: DataTableColumn<DailyTaskKpiRow>[] = [
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
  { key: 'days', header: 'Days worked', align: 'right', render: (row) => row.daysWorked },
  { key: 'planned', header: 'Planned', align: 'right', render: (row) => row.planned },
  { key: 'completed', header: 'Completed', align: 'right', render: (row) => row.completed },
  { key: 'overdue', header: 'Overdue', align: 'right', render: (row) => row.overdue },
  { key: 'carried', header: 'Carried over', align: 'right', render: (row) => row.carriedOver },
  {
    key: 'rate',
    header: 'Completion',
    align: 'right',
    render: (row) => rateLabel(completionRate(row.completed, row.planned)),
  },
]

/** How the plans people make at clock-in turn out, per person, over a range. */
export function DailyTaskKpiPanel() {
  const range = useAttendanceRange()
  const kpis = useDailyTaskKpis(range.from, range.to)

  const rows = kpis.data ?? []
  const planned = rows.reduce((sum, row) => sum + row.planned, 0)
  const completed = rows.reduce((sum, row) => sum + row.completed, 0)
  const overdue = rows.reduce((sum, row) => sum + row.overdue, 0)

  return (
    <Card p={{ base: 'md', sm: 'lg' }} component="section" aria-labelledby="kpi-heading">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={2}>
            <Title order={2} size="h5" id="kpi-heading">
              Daily task KPIs
            </Title>
            <Text size="xs" c="dimmed">
              Tasks each person planned when they clocked in, and how many got done.
            </Text>
          </Stack>
          <AttendanceRangeFields from={range.from} to={range.to} onChange={range.setRange} />
        </Group>

        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
          <StatCard label="Planned" value={planned} hint="Tasks listed at clock-in" />
          <StatCard label="Completed" value={completed} hint="Moved to a done status" />
          <StatCard
            label="Completion"
            value={rateLabel(completionRate(completed, planned))}
            hint="Completed out of planned"
          />
          <StatCard label="Overdue" value={overdue} hint="Not done and their day is over" />
        </SimpleGrid>

        <DataTable
          label="Daily task KPIs per employee"
          columns={columns}
          rows={kpis.data}
          rowKey={(row) => row.userId}
          isPending={kpis.isPending}
          isError={kpis.isError}
          isFetching={kpis.isFetching}
          error={kpis.error}
          errorTitle="Could not load the KPIs"
          onRetry={() => void kpis.refetch()}
          empty={
            <EmptyState
              title="Nobody to measure yet"
              description="Invite your team — their daily plans show up here once they clock in."
            />
          }
        />
      </Stack>
    </Card>
  )
}
