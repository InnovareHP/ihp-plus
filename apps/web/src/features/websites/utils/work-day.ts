import {
  clockToMinutes,
  minutesOfDay,
  minutesToClock,
  shiftDateKey,
  workDateKey,
  zonedInstant,
} from '@ihp/clock'

// The IT lead works 8 PM to 4 AM, so a morning check still belongs to the shift that began the evening before.
export const WORK_DAY_STARTS_AT_MINUTES = 12 * 60

/** The shift an instant belongs to, named by the date that shift started on. */
export function websiteDayKey(at: Date, timeZone: string): string {
  const date = workDateKey(at, timeZone)
  return minutesOfDay(at, timeZone) < WORK_DAY_STARTS_AT_MINUTES ? shiftDateKey(date, -1) : date
}

/** The instant a time typed for a shift names: before noon is the morning after it began. */
export function shiftInstant(dateKey: string, time: string, timeZone: string): Date | undefined {
  const minutes = clockToMinutes(time)
  if (minutes === undefined) return undefined
  const day = minutes < WORK_DAY_STARTS_AT_MINUTES ? shiftDateKey(dateKey, 1) : dateKey
  return zonedInstant(day, time, timeZone)
}

/** An instant as a time input's HH:mm value in the organization's zone. */
export function shiftClock(at: Date | string, timeZone: string): string {
  return minutesToClock(minutesOfDay(typeof at === 'string' ? new Date(at) : at, timeZone))
}
