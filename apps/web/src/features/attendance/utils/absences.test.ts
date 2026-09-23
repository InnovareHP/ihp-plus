import { describe, expect, it } from 'vitest'
import { absencesOf, personDateKey } from './absences'

const ADA = { userId: 'u-1', userName: 'Ada', workdays: '1,2,3,4,5', since: '2026-01-01' }

const base = {
  people: [ADA],
  from: '2026-09-21',
  to: '2026-09-27',
  today: '2026-09-25',
  holidays: new Set<string>(),
  leave: new Map<string, string>(),
  worked: new Set<string>(),
}

describe('absencesOf', () => {
  it('counts every settled weekday nobody clocked, and never today or the weekend', () => {
    expect(absencesOf(base).map((row) => row.workDate)).toEqual([
      '2026-09-24',
      '2026-09-23',
      '2026-09-22',
      '2026-09-21',
    ])
  })

  it('skips a worked day and a holiday, and calls approved leave leave', () => {
    const rows = absencesOf({
      ...base,
      worked: new Set([personDateKey('u-1', '2026-09-21')]),
      holidays: new Set(['2026-09-22']),
      leave: new Map([[personDateKey('u-1', '2026-09-23'), 'Vacation leave']]),
    })

    expect(rows.map((row) => [row.workDate, row.kind, row.leaveName])).toEqual([
      ['2026-09-24', 'absent', undefined],
      ['2026-09-23', 'leave', 'Vacation leave'],
    ])
  })

  it('starts counting on the day somebody could first have been expected', () => {
    const rows = absencesOf({ ...base, people: [{ ...ADA, since: '2026-09-24' }] })
    expect(rows.map((row) => row.workDate)).toEqual(['2026-09-24'])
  })

  it("follows each person's own working days", () => {
    const rows = absencesOf({ ...base, people: [{ ...ADA, workdays: '6' }], today: '2026-09-28' })
    expect(rows.map((row) => row.workDate)).toEqual(['2026-09-26'])
  })

  it('returns nothing for a range entirely in the future', () => {
    expect(absencesOf({ ...base, from: '2026-10-01', to: '2026-10-09' })).toEqual([])
  })
})
