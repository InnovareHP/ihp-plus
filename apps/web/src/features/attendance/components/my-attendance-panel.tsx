'use client'

import { Card, Group, Stack, Text, Title } from '@mantine/core'
import { useAttendanceRange } from '../hooks/use-attendance-range'
import { useAttendanceLog, useTimeClock } from '../hooks/use-time-clock'
import { AttendanceLogTable } from './attendance-log-table'
import { AttendanceRangeFields } from './attendance-range-fields'
import { DayTotals } from './day-totals'
import { ExportTimesheetButton } from './export-timesheet-button'

/** A member's own history: the range in the URL, the totals above the rows. */
export function MyAttendancePanel() {
  const range = useAttendanceRange()
  const clock = useTimeClock()
  const log = useAttendanceLog({ from: range.from, to: range.to })
  const timeZone = clock.data?.settings.timeZone ?? 'UTC'

  return (
    <Card padding="lg" component="section" aria-labelledby="my-attendance-heading">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={2}>
            <Title order={2} size="h5" id="my-attendance-heading">
              Your days
            </Title>
            <Text size="xs" c="dimmed">
              Times are shown in the company zone, {timeZone}.
            </Text>
          </Stack>
          <Group gap="sm" align="flex-end" wrap="wrap">
            <AttendanceRangeFields from={range.from} to={range.to} onChange={range.setRange} />
            <ExportTimesheetButton
              days={log.data?.days}
              from={range.from}
              to={range.to}
              timeZone={timeZone}
            />
          </Group>
        </Group>

        <DayTotals
          workedSeconds={log.data?.totalWorkedSeconds ?? 0}
          breakSeconds={log.data?.totalBreakSeconds ?? 0}
          lateSeconds={log.data?.totalLateSeconds ?? 0}
        />

        <AttendanceLogTable
          days={log.data?.days}
          isPending={log.isPending}
          isError={log.isError}
          isFetching={log.isFetching}
          onRetry={() => void log.refetch()}
          timeZone={timeZone}
          emptyHint="Clock in on the card above and today will show up here."
        />
      </Stack>
    </Card>
  )
}
