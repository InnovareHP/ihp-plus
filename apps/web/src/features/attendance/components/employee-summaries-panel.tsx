'use client'

import { Alert, Button, Card, Group, Select, Skeleton, Stack, Text, Title } from '@mantine/core'
import { EmptyState } from '@/components/empty-state'
import { useEmployeeSummaries } from '../hooks/use-attendance-admin'
import { useAttendanceRange } from '../hooks/use-attendance-range'
import { reissueStatement } from '../utils/statement-output'
import { AttendanceRangeFields } from './attendance-range-fields'
import { EmployeeSummaryCard } from './employee-summary-card'

/** The admin's per-employee review: time worked, daily tasks and invoices, all read-only. */
export function EmployeeSummariesPanel() {
  const range = useAttendanceRange()
  const summaries = useEmployeeSummaries(range.from, range.to)
  const people = summaries.data ?? []
  const shown = range.userId ? people.filter((one) => one.userId === range.userId) : people

  return (
    <Stack gap="md">
      <Card p={{ base: 'md', sm: 'lg' }} component="section" aria-labelledby="summaries-heading">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={2}>
            <Title order={2} size="h5" id="summaries-heading">
              Employee summaries
            </Title>
            <Text size="xs" c="dimmed">
              Days and hours come from the timesheet and cannot be changed here.
            </Text>
          </Stack>
          <Group gap="sm" align="flex-end" wrap="wrap" w={{ base: '100%', sm: 'auto' }}>
            <Select
              w={{ base: '100%', sm: 220 }}
              label="Employee"
              placeholder="Everyone"
              clearable
              searchable
              value={range.userId || null}
              data={people.map((one) => ({ value: one.userId, label: one.userName }))}
              onChange={(value) => range.setRange({ userId: value ?? '' })}
            />
            <AttendanceRangeFields from={range.from} to={range.to} onChange={range.setRange} />
          </Group>
        </Group>
      </Card>

      {summaries.isPending ? (
        <Stack gap="md" aria-busy="true" aria-label="Loading employee summaries">
          <Skeleton height={320} radius="md" />
          <Skeleton height={320} radius="md" />
        </Stack>
      ) : summaries.isError ? (
        <Alert color="red" title="Could not load the summaries" role="alert">
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{summaries.error.message}</Text>
            <Button onClick={() => void summaries.refetch()}>Try again</Button>
          </Stack>
        </Alert>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            title="Nobody to summarize"
            description={
              range.userId
                ? 'That employee is not on the team any more. Clear the filter to see everyone.'
                : 'Invite your team. Their summaries appear here once they clock in.'
            }
            action={
              range.userId ? (
                <Button variant="default" onClick={() => range.setRange({ userId: '' })}>
                  Clear filter
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Stack gap="md" opacity={summaries.isFetching ? 0.6 : 1}>
          {shown.map((summary) => (
            <EmployeeSummaryCard
              key={summary.userId}
              summary={summary}
              onOutput={(statement, output) => void reissueStatement(statement, output)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
