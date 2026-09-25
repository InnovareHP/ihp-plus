import { describe, expect, it } from 'vitest'
import type { AttendanceDayRow } from '../schema'
import { timesheetCsv } from './csv'

const DAY: AttendanceDayRow = {
  id: 'day-1',
  userId: 'user-1',
  userName: 'Grace Reyes',
  workDate: '2026-09-22',
  clockInAt: '2026-09-22T01:05:00.000Z',
  clockOutAt: '2026-09-22T10:05:00.000Z',
  workedSeconds: 8 * 3600,
  breakSeconds: 3600,
  lateSeconds: 600,
  status: 'recorded',
  source: 'clock',
  note: 'Covered the front desk, then stock',
  clockInSelfieUrl: undefined,
  clockOutSelfieUrl: undefined,
  clockInLocation: undefined,
  clockOutLocation: undefined,
  isOpen: false,
  onBreak: false,
  breaks: [],
  autoClosed: false,
}

describe('timesheetCsv', () => {
  it('writes a header and the hours as decimals in the company zone', () => {
    const [header, row] = timesheetCsv([DAY], 'Asia/Manila').split('\n')

    expect(header).toBe(
      'Employee,Date,Clock in,Clock out,Worked hours,Break hours,Late minutes,Status,Source,Note',
    )
    expect(row).toContain('Grace Reyes,2026-09-22,09:05,18:05,8.00,1.00,10,recorded,clock')
  })

  it('marks a missed clock-out and lists the days nobody clocked, newest first', () => {
    const rows = timesheetCsv([{ ...DAY, autoClosed: true }], 'UTC', [
      {
        userId: 'user-1',
        userName: 'Grace Reyes',
        workDate: '2026-09-23',
        kind: 'leave',
        leaveName: 'Vacation leave',
        granted: false,
      },
      {
        userId: 'user-1',
        userName: 'Grace Reyes',
        workDate: '2026-09-21',
        kind: 'absent',
        leaveName: undefined,
        granted: false,
      },
    ]).split('\n')

    expect(rows[1]).toBe('Grace Reyes,2026-09-23,,,0.00,0.00,0,leave,,Vacation leave')
    expect(rows[2]).toContain('Grace Reyes,2026-09-22,')
    expect(rows[2]).toContain(',missed clock-out,')
    expect(rows[3]).toBe('Grace Reyes,2026-09-21,,,0.00,0.00,0,absent,,')
  })

  it('quotes a note that carries a comma', () => {
    expect(timesheetCsv([DAY], 'UTC')).toContain('"Covered the front desk, then stock"')
  })

  it('defuses a note a spreadsheet would run as a formula', () => {
    const csv = timesheetCsv([{ ...DAY, note: '=SUM(A1:A9)' }], 'UTC')
    expect(csv).toContain("'=SUM(A1:A9)")
  })
})
