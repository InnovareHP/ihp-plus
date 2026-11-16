'use client'

import { Alert, Button, Card, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core'
import { StatCard } from '@/components/stat-card'
import { useEmployeeSummaries } from '../hooks/use-attendance-admin'
import { useCalendarParams } from '../hooks/use-calendar'
import { formatUsd } from '../utils/billing-statement'
import { formatMonth, monthOf } from '../utils/calendar'
import { monthRange, monthlyReport } from '../utils/monthly-report'
import { MonthNav } from './month-nav'
import { MonthlyReportTable } from './monthly-report-table'
import { SummaryTasks } from './summary-tasks'

const hours = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** The month-end report an admin will be emailed: tasks accomplished and pay, viewed in app for now. */
export function MonthlyReportPanel() {
  const params = useCalendarParams()
  const thisMonth = monthOf(new Date().toISOString())
  const month = params.month || thisMonth
  const { from, to } = monthRange(month)
  const summaries = useEmployeeSummaries(from, to)
  const report = monthlyReport(summaries.data ?? [], month)
  const title = formatMonth(month)

  return (
    <Stack gap="md">
      <Card p={{ base: 'md', sm: 'lg' }} component="section" aria-labelledby="monthly-heading">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={2}>
            <Title order={2} size="h5" id="monthly-heading">
              Monthly report · {title}
            </Title>
            <Text size="xs" c="dimmed">
              {month === thisMonth
                ? 'This month so far. Salary counts statements whose billing period ends this month.'
                : 'Salary counts statements whose billing period ends this month.'}
            </Text>
          </Stack>
          <MonthNav month={month} thisMonth={thisMonth} onChange={params.setMonth} />
        </Group>
      </Card>

      {summaries.isPending ? (
        <Stack gap="md" aria-busy="true" aria-label="Loading the monthly report">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Skeleton height={110} radius="md" />
            <Skeleton height={110} radius="md" />
            <Skeleton height={110} radius="md" />
          </SimpleGrid>
          <Skeleton height={240} radius="md" />
        </Stack>
      ) : summaries.isError ? (
        <Alert color="red" title="Could not load the monthly report" role="alert">
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{summaries.error.message}</Text>
            <Button onClick={() => void summaries.refetch()}>Try again</Button>
          </Stack>
        </Alert>
      ) : (
        <Stack gap="md" opacity={summaries.isFetching ? 0.6 : 1}>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <StatCard
              label="Total salary"
              value={formatUsd(report.totals.salaryCents)}
              hint="From filed billing statements"
            />
            <StatCard
              label="Tasks accomplished"
              value={report.totals.tasksDone}
              hint="Daily tasks marked done"
            />
            <StatCard
              label="Hours worked"
              value={hours.format(report.totals.hoursWorked)}
              hint="From the timesheet"
            />
          </SimpleGrid>

          <Card p={{ base: 'md', sm: 'lg' }}>
            <MonthlyReportTable label={`Monthly report for ${title}`} rows={report.rows} />
          </Card>

          <Title order={3} size="h5">
            Accomplished tasks
          </Title>
          {report.rows.map((row) => (
            <Card key={row.userId} p={{ base: 'md', sm: 'lg' }}>
              <SummaryTasks title={`Accomplished by ${row.userName}`} tasks={row.accomplished} />
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
