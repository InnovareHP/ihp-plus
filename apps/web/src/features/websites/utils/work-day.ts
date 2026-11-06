import { minutesOfDay, shiftDateKey, workDateKey } from '@ihp/clock'

// The IT lead works 8 PM to 4 AM, so a morning check still belongs to the shift that began the evening before.
export const WORK_DAY_STARTS_AT_MINUTES = 12 * 60

/** The shift an instant belongs to, named by the date that shift started on. */
export function websiteDayKey(at: Date, timeZone: string): string {
  const date = workDateKey(at, timeZone)
  return minutesOfDay(at, timeZone) < WORK_DAY_STARTS_AT_MINUTES ? shiftDateKey(date, -1) : date
}
