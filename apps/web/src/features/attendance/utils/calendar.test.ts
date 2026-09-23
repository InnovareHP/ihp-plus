import { describe, expect, it } from 'vitest'
import { datesOfMonth, formatMonth, isMonthKey, shiftMonth, weeksOfMonth } from './calendar'

describe('calendar months', () => {
  it('accepts only a real YYYY-MM', () => {
    expect(isMonthKey('2026-09')).toBe(true)
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey('2026-9')).toBe(false)
  })

  it('moves across a year end in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('knows how long February is', () => {
    expect(datesOfMonth('2028-02')).toHaveLength(29)
    expect(datesOfMonth('2026-02').at(-1)).toBe('2026-02-28')
  })

  it('lays the month out Sunday first, padding the weeks it shares', () => {
    // 1 September 2026 is a Tuesday.
    const weeks = weeksOfMonth('2026-09')
    expect(weeks[0]).toEqual([
      null,
      null,
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ])
    expect(weeks.at(-1)).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      null,
      null,
      null,
    ])
    expect(weeks.every((week) => week.length === 7)).toBe(true)
  })

  it('names the month the way the page heading reads it', () => {
    expect(formatMonth('2026-09')).toBe('September 2026')
  })
})
