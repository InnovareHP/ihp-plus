import { describe, expect, it } from 'vitest'
import {
  datesOf,
  MAX_TIME_OFF_DAYS,
  TIME_OFF_FIRST_DAY,
  TIME_OFF_LAST_DAY,
  timeOffRangeOf,
  withTimeOffFields,
} from './time-off'

const range = (from: string, to: string) => ({
  [TIME_OFF_FIRST_DAY]: from,
  [TIME_OFF_LAST_DAY]: to,
})

describe('time off', () => {
  it('reads a single day and a range', () => {
    expect(timeOffRangeOf(range('2026-10-05', '2026-10-05'))).toEqual({
      range: { from: '2026-10-05', to: '2026-10-05' },
    })
    expect(timeOffRangeOf(range('2026-10-05', '2026-10-09'))).toEqual({
      range: { from: '2026-10-05', to: '2026-10-09' },
    })
  })

  it('refuses a missing day, a backwards range and one past the cap', () => {
    expect(timeOffRangeOf({})).toMatchObject({ field: TIME_OFF_FIRST_DAY })
    expect(timeOffRangeOf({ [TIME_OFF_FIRST_DAY]: '2026-10-05' })).toMatchObject({
      field: TIME_OFF_LAST_DAY,
    })
    expect(timeOffRangeOf(range('2026-10-09', '2026-10-05'))).toMatchObject({
      problem: 'The last day off cannot be before the first.',
    })
    expect(timeOffRangeOf(range('2026-01-01', '2026-03-05'))).toMatchObject({
      problem: `Ask for at most ${MAX_TIME_OFF_DAYS} days at a time.`,
    })
  })

  it('lists every date across a month end, both ends included', () => {
    expect(datesOf({ from: '2026-10-30', to: '2026-11-02' })).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
  })

  it('puts the date questions first once, and restores them if they were edited', () => {
    const other = {
      id: 'why',
      type: 'text' as const,
      label: 'Why?',
      help: '',
      placeholder: '',
      required: false,
      options: [],
    }
    const tampered = { ...other, id: TIME_OFF_FIRST_DAY, type: 'text' as const, required: false }

    const fields = withTimeOffFields([other, tampered])

    expect(fields.map((field) => field.id)).toEqual([TIME_OFF_FIRST_DAY, TIME_OFF_LAST_DAY, 'why'])
    expect(fields[0]).toMatchObject({ type: 'date', required: true, label: 'First day off' })
  })
})
