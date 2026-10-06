import { describe, expect, it } from 'vitest'
import { workingDatesOf } from './working-days'

const WEEKDAYS = { workdays: '1,2,3,4,5', holidayCountry: 'PH' }

describe('workingDatesOf', () => {
  it('skips the days the shift does not work', () => {
    // Friday 9 October to Tuesday 13 October 2026.
    expect(workingDatesOf('2026-10-09', '2026-10-13', WEEKDAYS, [])).toEqual([
      '2026-10-09',
      '2026-10-12',
      '2026-10-13',
    ])
  })

  it('skips company-wide holidays and the shift country’s, but not another country’s', () => {
    const holidays = [
      { date: '2026-10-12', name: 'Company day', country: '' },
      { date: '2026-10-13', name: 'Local holiday', country: 'PH' },
      { date: '2026-10-14', name: 'Elsewhere', country: 'US' },
    ]
    expect(workingDatesOf('2026-10-12', '2026-10-14', WEEKDAYS, holidays)).toEqual(['2026-10-14'])
  })

  it('counts a weekend for a shift that works it, and nothing for an empty range', () => {
    const everyDay = { workdays: '0,1,2,3,4,5,6', holidayCountry: '' }
    expect(workingDatesOf('2026-10-10', '2026-10-11', everyDay, [])).toHaveLength(2)
    expect(workingDatesOf('2026-10-11', '2026-10-10', everyDay, [])).toEqual([])
  })
})
