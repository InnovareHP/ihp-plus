import { isWorkday, shiftDateKey } from '@ihp/clock'
import { holidayFor, type HolidayEntry } from './holidays'

export interface WorkPattern {
  workdays: string
  holidayCountry: string
}

/** The dates from `from` to `to`, both included, that the shift works and no holiday covers. */
export function workingDatesOf(
  from: string,
  to: string,
  pattern: WorkPattern,
  holidays: readonly HolidayEntry[],
): string[] {
  const dates: string[] = []
  for (let date = from; date <= to; date = shiftDateKey(date, 1)) {
    if (!isWorkday(date, pattern.workdays)) continue
    if (holidayFor(holidays, date, pattern.holidayCountry)) continue
    dates.push(date)
  }
  return dates
}
