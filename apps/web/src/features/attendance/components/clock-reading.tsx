'use client'

import { Stack, Text } from '@mantine/core'
import type { AttendanceDayRow, AttendanceState } from '../schema'
import { formatElapsed, formatTimeOfDay } from '@ihp/clock'
import { liveWorkedSeconds, runningBreakStartedAt } from '../utils/day'

export interface ClockReadingProps {
  day: AttendanceDayRow | undefined
  now: number
  state: AttendanceState
  timeZone: string
}

/** The big number on the clock: hours worked, or the break's own stopwatch while one runs. */
export function ClockReading({ day, now, state, timeZone }: ClockReadingProps) {
  if (!day) {
    return (
      <Text fz={44} fw={700} lh={1.1} ff="monospace">
        00:00:00
      </Text>
    )
  }

  const breakStartedAt = runningBreakStartedAt(day)
  const seconds =
    state === 'break' && breakStartedAt
      ? Math.max(Math.floor((now - breakStartedAt) / 1000), 0)
      : liveWorkedSeconds(day, now)

  return (
    <Stack gap={0}>
      <Text fz={44} fw={700} lh={1.1} ff="monospace" aria-live="polite">
        {formatElapsed(seconds)}
      </Text>
      <Text size="xs" c="dimmed">
        {state === 'break' ? 'On break since' : 'Since'}{' '}
        {formatTimeOfDay(new Date(breakStartedAt ?? Date.parse(day.clockInAt)), timeZone)}
      </Text>
    </Stack>
  )
}
