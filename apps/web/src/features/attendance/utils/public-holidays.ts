import { shiftDateKey } from '@ihp/clock'
import Holidays from 'date-holidays'

export interface PublicHoliday {
  /** YYYY-MM-DD, the calendar date in the country itself. */
  date: string
  name: string
}

export interface HolidayCountryOption {
  code: string
  name: string
}

// 'optional' is where the calendar files the Philippines' special non-working days.
const DAYS_OFF = new Set(['public', 'bank', 'optional'])

let countries: HolidayCountryOption[] | undefined

export function holidayCountries(): HolidayCountryOption[] {
  countries ??= Object.entries(new Holidays().getCountries('en'))
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return countries
}

export function isHolidayCountry(code: string) {
  return holidayCountries().some((country) => country.code === code)
}

/** Every day off in one country's year, a multi-day holiday spread over each of its dates. */
export function publicHolidays(country: string, year: number): PublicHoliday[] {
  const calendar = new Holidays(country, { languages: ['en'] })
  const days = new Map<string, string>()

  for (const holiday of calendar.getHolidays(year) || []) {
    if (!DAYS_OFF.has(holiday.type)) continue

    // The date string is local to the country, so its first ten characters are the calendar date.
    const first = holiday.date.slice(0, 10)
    const span = Math.max(1, Math.round((holiday.end.getTime() - holiday.start.getTime()) / 864e5))
    for (let offset = 0; offset < span; offset += 1) {
      const date = shiftDateKey(first, offset)
      // Two observances on one date keep the first, which the calendar lists as the main one.
      if (date.startsWith(String(year)) && !days.has(date)) days.set(date, holiday.name)
    }
  }

  return [...days]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
