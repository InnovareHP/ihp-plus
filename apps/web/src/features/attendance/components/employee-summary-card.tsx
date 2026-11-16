'use client'

import { Card, Group, Stack, Text, Title } from '@mantine/core'
import type { BillingStatementRow, EmployeeSummaryRow } from '../schema'
import { completionRate } from '../utils/daily-task-kpis'
import type { StatementOutput } from '../utils/statement-output'
import { BillingStatementsTable } from './billing-statements-table'
import { SummaryTasks } from './summary-tasks'
import { WorkedTime } from './worked-time'

export interface EmployeeSummaryCardProps {
  summary: EmployeeSummaryRow
  onOutput: (statement: BillingStatementRow, output: StatementOutput) => void
}

/** One employee over the range: time worked, the day plans, and the statements they filed. */
export function EmployeeSummaryCard({ summary, onOutput }: EmployeeSummaryCardProps) {
  const done = summary.tasks.filter((task) => task.isDone).length
  const rate = completionRate(done, summary.tasks.length)
  const headingId = `summary-${summary.userId}`

  return (
    <Card p={{ base: 'md', sm: 'lg' }} component="article" aria-labelledby={headingId}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={0}>
            <Title order={3} size="h5" id={headingId}>
              {summary.userName}
            </Title>
            {summary.jobTitle ? (
              <Text size="sm" c="dimmed">
                {summary.jobTitle}
              </Text>
            ) : null}
          </Stack>
          <Text size="sm" c="dimmed">
            {done} of {summary.tasks.length} tasks done{rate === undefined ? '' : ` (${rate}%)`}
          </Text>
        </Group>

        <WorkedTime daysWorked={summary.daysWorked} hoursWorked={summary.hoursWorked} />
        {summary.paidDaysOff > 0 ? (
          <Text size="xs" c="dimmed">
            Days worked includes {summary.paidDaysOff} paid{' '}
            {summary.paidDaysOff === 1 ? 'day' : 'days'} off.
          </Text>
        ) : null}

        <SummaryTasks title={`Daily tasks for ${summary.userName}`} tasks={summary.tasks} />

        <BillingStatementsTable
          title={`Invoices from ${summary.userName}`}
          titleOrder={4}
          statements={summary.statements}
          isPending={false}
          isError={false}
          isFetching={false}
          onRetry={() => undefined}
          onOutput={onOutput}
          emptyHint="No billing statement filed for this period yet."
        />
      </Stack>
    </Card>
  )
}
