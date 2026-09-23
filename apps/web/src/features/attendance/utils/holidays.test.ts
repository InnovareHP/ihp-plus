import { describe, expect, it } from 'vitest'
import { holidayAppliesTo, holidayFor } from './holidays'

const HOLIDAYS = [
  { date: '2026-06-12', name: 'Independence Day', country: 'PH' },
  { date: '2026-07-04', name: 'Independence Day', country: 'US' },
  { date: '2026-12-25', name: 'Company Christmas', country: '' },
  { date: '2026-12-25', name: 'Christmas Day', country: 'PH' },
]

describe('holidays by shift', () => {
  it('gives a company-wide day to every shift, whatever country it follows', () => {
    expect(holidayAppliesTo('', 'PH')).toBe(true)
    expect(holidayAppliesTo('', '')).toBe(true)
  })

  it('gives a country’s day only to shifts following that country', () => {
    expect(holidayFor(HOLIDAYS, '2026-06-12', 'PH')?.name).toBe('Independence Day')
    expect(holidayFor(HOLIDAYS, '2026-06-12', 'US')).toBeUndefined()
    expect(holidayFor(HOLIDAYS, '2026-06-12', '')).toBeUndefined()
  })

  it('names the day by the shift’s own country when both calendars have it', () => {
    expect(holidayFor(HOLIDAYS, '2026-12-25', 'PH')?.name).toBe('Christmas Day')
    expect(holidayFor(HOLIDAYS, '2026-12-25', 'US')?.name).toBe('Company Christmas')
  })
})
