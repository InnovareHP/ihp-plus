import type { AttendanceDayRow, AttendanceState } from '../schema'
import { workedSecondsFor } from './clock'

/** Breaks already taken, plus the one still running, counted up to now. */
export function liveBreakSeconds(day: AttendanceDayRow, now: number): number {
  return day.breaks.reduce((total, one) => {
    if (!one.isRunning) return total + one.seconds
    return total + Math.max(Math.floor((now - Date.parse(one.startedAt)) / 1000), 0)
  }, 0)
}

/** What the running clock reads: a closed day keeps the hours the server counted. */
export function liveWorkedSeconds(day: AttendanceDayRow, now: number): number {
  if (!day.isOpen) return day.workedSeconds
  return workedSecondsFor(new Date(day.clockInAt), new Date(now), liveBreakSeconds(day, now))
}

export function dayState(day: AttendanceDayRow | undefined): AttendanceState {
  if (!day) return 'absent'
  if (!day.isOpen) return 'out'
  return day.onBreak ? 'break' : 'in'
}

export function runningBreakStartedAt(day: AttendanceDayRow): number | undefined {
  const running = day.breaks.find((one) => one.isRunning)
  return running ? Date.parse(running.startedAt) : undefined
}
