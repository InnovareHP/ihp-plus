'use client'

import { Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { formatTimeOfDay, minutesToClock, workDateKey } from '@ihp/clock'
import { useState } from 'react'
import { useMyCorrections, useWithdrawCorrection } from '../hooks/use-corrections'
import { useAttendanceRange } from '../hooks/use-attendance-range'
import { useAttendanceLog, useTimeClock } from '../hooks/use-time-clock'
import type { AttendanceDayRow, CorrectionValues } from '../schema'
import { AbsencesTable } from './absences-table'
import { AttendanceLogTable } from './attendance-log-table'
import { AttendanceRangeFields } from './attendance-range-fields'
import { BillingStatementButton } from './billing-statement-button'
import { CorrectionRequestModal } from './correction-request-modal'
import { DayTotals } from './day-totals'
import { ExportTimesheetButton } from './export-timesheet-button'
import { MyCorrectionsTable } from './my-corrections-table'

/** A member's own history: the range in the URL, the totals above the rows. */
export function MyAttendancePanel() {
  const range = useAttendanceRange()
  const clock = useTimeClock()
  const log = useAttendanceLog({ from: range.from, to: range.to })
  const corrections = useMyCorrections()
  const withdraw = useWithdrawCorrection()
  const timeZone = clock.data?.settings.timeZone ?? 'UTC'
  const today = workDateKey(new Date(), timeZone)
  // Which day the request form is open on is a disclosure nothing else reads.
  const [asking, setAsking] = useState<CorrectionValues | undefined>(undefined)

  function askAbout(day: AttendanceDayRow) {
    setAsking({
      workDate: day.workDate,
      clockInTime: formatTimeOfDay(day.clockInAt, timeZone),
      clockOutTime: day.clockOutAt ? formatTimeOfDay(day.clockOutAt, timeZone) : '',
      breakMinutes: Math.round(day.breakSeconds / 60),
      reason: '',
    })
  }

  function askAboutAnotherDay() {
    const shift = clock.data?.shift
    setAsking({
      workDate: today,
      clockInTime: shift ? minutesToClock(shift.shiftStartMinutes) : '09:00',
      clockOutTime: shift ? minutesToClock(shift.shiftEndMinutes) : '18:00',
      breakMinutes: 0,
      reason: '',
    })
  }

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
              absences={log.data?.absences}
              from={range.from}
              to={range.to}
              timeZone={timeZone}
            />
            <BillingStatementButton
              days={log.data?.days}
              from={range.from}
              to={range.to}
              today={today}
            />
            <Button variant="default" onClick={askAboutAnotherDay}>
              Ask for a correction
            </Button>
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
          // A running day is still the member's to clock out of, so only a finished one is asked about.
          actions={(day) =>
            day.isOpen ? null : (
              <Button
                variant="subtle"
                size="compact-sm"
                onClick={() => askAbout(day)}
                aria-label={`Ask to correct ${day.workDate}`}
              >
                Ask to correct
              </Button>
            )
          }
          emptyHint="Clock in on the card above and today will show up here."
        />

        <AbsencesTable
          absences={log.data?.absences}
          isPending={log.isPending}
          isError={log.isError}
          isFetching={log.isFetching}
          onRetry={() => void log.refetch()}
        />

        <MyCorrectionsTable
          corrections={corrections.data}
          isPending={corrections.isPending}
          isError={corrections.isError}
          isFetching={corrections.isFetching}
          onRetry={() => void corrections.refetch()}
          onWithdraw={(row) => withdraw.mutate({ correctionId: row.id })}
        />

        {asking ? (
          <CorrectionRequestModal
            key={asking.workDate}
            opened
            onClose={() => setAsking(undefined)}
            initial={asking}
            today={today}
          />
        ) : null}
      </Stack>
    </Card>
  )
}
