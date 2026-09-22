'use client'

import { Card, Group, Select, Stack, Title } from '@mantine/core'
import { useState } from 'react'
import { useSchedules } from '../hooks/use-attendance-admin'
import { useAttendanceRange } from '../hooks/use-attendance-range'
import { useAttendanceLog } from '../hooks/use-time-clock'
import type { AttendanceDayRow } from '../schema'
import { AttendanceDayActions } from './attendance-day-actions'
import { AttendanceDayModal } from './attendance-day-modal'
import { AttendanceLogTable } from './attendance-log-table'
import { AttendanceRangeFields } from './attendance-range-fields'
import { DayTotals } from './day-totals'
import { ExportTimesheetButton } from './export-timesheet-button'

export interface TeamTimesheetPanelProps {
  timeZone: string
}

/** The range everyone's hours are read and signed off through, and exported from. */
export function TeamTimesheetPanel({ timeZone }: TeamTimesheetPanelProps) {
  const range = useAttendanceRange()
  const people = useSchedules()
  const [correcting, setCorrecting] = useState<AttendanceDayRow | undefined>(undefined)

  const log = useAttendanceLog({
    from: range.from,
    to: range.to,
    userId: range.userId || undefined,
    everyone: !range.userId,
  })

  return (
    <Card padding="lg" component="section" aria-labelledby="team-timesheet-heading">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Title order={2} size="h5" id="team-timesheet-heading">
            Timesheets
          </Title>
          <Group gap="sm" align="flex-end" wrap="wrap">
            <Select
              label="Employee"
              placeholder="Everyone"
              clearable
              searchable
              value={range.userId || null}
              data={(people.data?.schedules ?? []).map((person) => ({
                value: person.userId,
                label: person.userName,
              }))}
              onChange={(value) => range.setRange({ userId: value ?? '' })}
            />
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
          showPerson={!range.userId}
          actions={(day) => <AttendanceDayActions day={day} onCorrect={setCorrecting} />}
          emptyHint="Nobody clocked in over this range — widen the dates or add a day by hand."
        />

        {correcting ? (
          <AttendanceDayModal
            opened
            onClose={() => setCorrecting(undefined)}
            person={{ userId: correcting.userId, userName: correcting.userName }}
            workDate={correcting.workDate}
            timeZone={timeZone}
            day={correcting}
          />
        ) : null}
      </Stack>
    </Card>
  )
}
