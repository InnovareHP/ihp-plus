'use client'

import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { attendanceKeys } from '../query-keys'
import type { AttendanceDayRow, AttendanceLog, TimeClockView } from '../schema'

export type LogSnapshot = [QueryKey, AttendanceLog | undefined][]
export type ClockSnapshot = TimeClockView | undefined

function totalsOf(days: readonly AttendanceDayRow[]) {
  return {
    totalWorkedSeconds: days.reduce((total, day) => total + day.workedSeconds, 0),
    totalBreakSeconds: days.reduce((total, day) => total + day.breakSeconds, 0),
    totalLateSeconds: days.reduce((total, day) => total + day.lateSeconds, 0),
  }
}

/**
 * Applies a change to every timesheet already on screen and hands back what was there, so the
 * caller can put it back exactly — a rollback never recomputes the old value.
 */
export async function editLogs(
  queryClient: QueryClient,
  edit: (days: readonly AttendanceDayRow[]) => AttendanceDayRow[],
): Promise<LogSnapshot> {
  // An in-flight refetch would land on top of the optimistic value.
  await queryClient.cancelQueries({ queryKey: attendanceKeys.logs() })
  const previous = queryClient.getQueriesData<AttendanceLog>({ queryKey: attendanceKeys.logs() })

  for (const [key, log] of previous) {
    if (!log) continue
    const days = edit(log.days)
    queryClient.setQueryData<AttendanceLog>(key, { ...log, days, ...totalsOf(days) })
  }

  return previous
}

export function restoreLogs(queryClient: QueryClient, previous: LogSnapshot | undefined) {
  for (const [key, log] of previous ?? []) {
    queryClient.setQueryData(key, log)
  }
}

/** The same for the clock card, whose one query holds today's row. */
export async function editClock(
  queryClient: QueryClient,
  edit: (day: AttendanceDayRow) => AttendanceDayRow,
): Promise<ClockSnapshot> {
  await queryClient.cancelQueries({ queryKey: attendanceKeys.clock() })
  const previous = queryClient.getQueryData<TimeClockView>(attendanceKeys.clock())
  if (!previous?.today) return previous

  queryClient.setQueryData<TimeClockView>(attendanceKeys.clock(), {
    ...previous,
    today: edit(previous.today),
  })

  return previous
}

export function restoreClock(queryClient: QueryClient, previous: ClockSnapshot) {
  if (previous) queryClient.setQueryData(attendanceKeys.clock(), previous)
}
