import { describe, expect, it } from 'vitest'
import { holidayCountries, isHolidayCountry, publicHolidays } from './public-holidays'

describe('public holidays', () => {
  it('lists the Philippines’ regular holidays and special non-working days', () => {
    const days = publicHolidays('PH', 2026)

    expect(days).toContainEqual({ date: '2026-06-12', name: 'Independence Day' })
    expect(days).toContainEqual({ date: '2026-12-30', name: 'Rizal Day' })
    // A special non-working day, which the calendar files as optional.
    expect(days).toContainEqual({ date: '2026-08-21', name: 'Ninoy Aquino Day' })
  })

  it('leaves out observances nobody gets off', () => {
    const dates = publicHolidays('PH', 2026).map((day) => day.date)

    // Constitution Day is observed, not a day off.
    expect(dates).not.toContain('2026-02-02')
  })

  it('keeps every day inside the year asked for, sorted', () => {
    const days = publicHolidays('US', 2026)

    expect(days.every((day) => day.date.startsWith('2026-'))).toBe(true)
    expect(days.map((day) => day.date)).toEqual([...days.map((day) => day.date)].sort())
    expect(days).toContainEqual({ date: '2026-11-26', name: 'Thanksgiving Day' })
  })

  it('knows which country codes it covers', () => {
    expect(isHolidayCountry('PH')).toBe(true)
    expect(isHolidayCountry('XX')).toBe(false)
    expect(holidayCountries().find((country) => country.code === 'PH')?.name).toBe('Philippines')
  })
})
