import { shiftDateKey } from '@ihp/clock'

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

export function isMonthKey(value: string) {
  return MONTH_KEY.test(value)
}

/** The month a YYYY-MM-DD key falls in, as YYYY-MM. */
export function monthOf(dateKey: string) {
  return dateKey.slice(0, 7)
}

/** Moves a YYYY-MM key by whole months, across year ends. */
export function shiftMonth(month: string, by: number) {
  const [year = 0, index = 1] = month.split('-').map(Number)
  const at = new Date(Date.UTC(year, index - 1 + by, 1))
  return at.toISOString().slice(0, 7)
}

/** Every date in the month, first to last. */
export function datesOfMonth(month: string): string[] {
  const dates: string[] = []
  const next = `${shiftMonth(month, 1)}-01`
  for (let date = `${month}-01`; date < next; date = shiftDateKey(date, 1)) dates.push(date)
  return dates
}

/**
 * The month as rows of seven, Sunday first, with null where a week spills into the month before
 * or after — the grid shows only this month's days.
 */
export function weeksOfMonth(month: string): (string | null)[][] {
  const dates = datesOfMonth(month)
  const lead = new Date(`${month}-01T00:00:00Z`).getUTCDay()
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...dates]
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (string | null)[][] = []
  for (let start = 0; start < cells.length; start += 7) weeks.push(cells.slice(start, start + 7))
  return weeks
}

const monthTitle = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatMonth(month: string) {
  return monthTitle.format(new Date(`${month}-01T00:00:00Z`))
}
