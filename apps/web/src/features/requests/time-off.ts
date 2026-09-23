import type { FormField, RequestValues } from './schema'

// Fixed ids, so an approval can find the dates whatever else the admin put on the form.
export const TIME_OFF_FIRST_DAY = 'time-off-first-day'
export const TIME_OFF_LAST_DAY = 'time-off-last-day'

/** Longer than this is a leave of absence, which needs a conversation rather than a form. */
export const MAX_TIME_OFF_DAYS = 60

const RESERVED: readonly FormField[] = [
  {
    id: TIME_OFF_FIRST_DAY,
    type: 'date',
    label: 'First day off',
    help: '',
    placeholder: '',
    required: true,
    options: [],
  },
  {
    id: TIME_OFF_LAST_DAY,
    type: 'date',
    label: 'Last day off',
    help: 'The same as the first day for a single day off.',
    placeholder: '',
    required: true,
    options: [],
  },
]

export function isTimeOffField(id: string) {
  return id === TIME_OFF_FIRST_DAY || id === TIME_OFF_LAST_DAY
}

/** The two date questions first and exactly as defined, then whatever else the admin asks. */
export function withTimeOffFields(fields: readonly FormField[]): FormField[] {
  return [...RESERVED, ...fields.filter((field) => !isTimeOffField(field.id))]
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function dayNumber(key: string) {
  return Date.parse(`${key}T00:00:00.000Z`) / 86_400_000
}

export interface TimeOffRange {
  from: string
  to: string
}

/** The range an answer asks for, or why it cannot be booked. */
export function timeOffRangeOf(
  values: RequestValues,
): { range: TimeOffRange } | { problem: string; field: string } {
  const from = values[TIME_OFF_FIRST_DAY]
  const to = values[TIME_OFF_LAST_DAY]

  if (typeof from !== 'string' || !DATE_KEY.test(from)) {
    return { problem: 'Pick the first day off.', field: TIME_OFF_FIRST_DAY }
  }
  if (typeof to !== 'string' || !DATE_KEY.test(to)) {
    return { problem: 'Pick the last day off.', field: TIME_OFF_LAST_DAY }
  }

  const span = dayNumber(to) - dayNumber(from)
  if (span < 0) {
    return { problem: 'The last day off cannot be before the first.', field: TIME_OFF_LAST_DAY }
  }
  if (span + 1 > MAX_TIME_OFF_DAYS) {
    return {
      problem: `Ask for at most ${MAX_TIME_OFF_DAYS} days at a time.`,
      field: TIME_OFF_LAST_DAY,
    }
  }

  return { range: { from, to } }
}

/** Every calendar date from the first day to the last, both included. */
export function datesOf({ from, to }: TimeOffRange): string[] {
  const dates: string[] = []
  const last = dayNumber(to)
  for (let day = dayNumber(from); day <= last; day += 1) {
    dates.push(new Date(day * 86_400_000).toISOString().slice(0, 10))
  }
  return dates
}
