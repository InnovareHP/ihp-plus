import { describe, expect, it } from 'vitest'
import {
  clockToMinutes,
  formatElapsed,
  formatHours,
  formatWorkdays,
  isWorkday,
  lateSecondsFor,
  minutesOfDay,
  minutesToClock,
  parseWorkdays,
  shiftDateKey,
  workDateKey,
  workedSecondsFor,
} from './clock'

describe('workdays', () => {
  it('keeps the days in order and drops rubbish', () => {
    expect(parseWorkdays('5,1, 3 ,9,abc,1')).toEqual([1, 3, 5])
  })

  it('names them the way a rota does', () => {
    expect(formatWorkdays('1,2,3,4,5')).toBe('Mon, Tue, Wed, Thu, Fri')
    expect(formatWorkdays('')).toBe('No set days')
  })

  it('says whether a date is worked', () => {
    // 2026-09-22 is a Tuesday.
    expect(isWorkday('2026-09-22', '1,2,3,4,5')).toBe(true)
    expect(isWorkday('2026-09-20', '1,2,3,4,5')).toBe(false)
  })
})

describe('times of day', () => {
  it('round-trips minutes and the clock they read as', () => {
    expect(minutesToClock(540)).toBe('09:00')
    expect(minutesToClock(1085)).toBe('18:05')
    expect(clockToMinutes('09:00')).toBe(540)
    expect(clockToMinutes('18:05')).toBe(1085)
  })

  it('refuses a time that is not one', () => {
    expect(clockToMinutes('25:00')).toBeUndefined()
    expect(clockToMinutes('9am')).toBeUndefined()
  })

  it('reads the wall clock in the zone the company counts in', () => {
    const at = new Date('2026-09-22T01:30:00.000Z')
    expect(minutesOfDay(at, 'UTC')).toBe(90)
    expect(minutesOfDay(at, 'Asia/Manila')).toBe(9 * 60 + 30)
  })
})

describe('durations', () => {
  it('reads hours and minutes the way people say them', () => {
    expect(formatHours(0)).toBe('0m')
    expect(formatHours(90 * 60)).toBe('1h 30m')
    expect(formatHours(2 * 3600)).toBe('2h')
  })

  it('reads a running clock as a clock', () => {
    expect(formatElapsed(3661)).toBe('01:01:01')
    expect(formatElapsed(-5)).toBe('00:00:00')
  })
})

describe('the day itself', () => {
  it('counts a work date in the organization zone, not the server one', () => {
    const at = new Date('2026-09-22T16:30:00.000Z')
    expect(workDateKey(at, 'UTC')).toBe('2026-09-22')
    // Half past midnight the next day in Manila.
    expect(workDateKey(at, 'Asia/Manila')).toBe('2026-09-23')
  })

  it('takes breaks out of the span and never goes negative', () => {
    const start = new Date('2026-09-22T09:00:00.000Z')
    const end = new Date('2026-09-22T18:00:00.000Z')
    expect(workedSecondsFor(start, end, 3600)).toBe(8 * 3600)
    expect(workedSecondsFor(start, end, 100 * 3600)).toBe(0)
  })

  it('forgives an arrival inside the grace and counts the whole lateness after it', () => {
    const shift = { shiftStartMinutes: 9 * 60, graceMinutes: 15, timeZone: 'UTC' }
    expect(lateSecondsFor({ ...shift, clockInAt: new Date('2026-09-22T09:10:00.000Z') })).toBe(0)
    expect(lateSecondsFor({ ...shift, clockInAt: new Date('2026-09-22T09:40:00.000Z') })).toBe(
      40 * 60,
    )
  })

  it('shifts a date key by whole days', () => {
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDateKey('2026-09-22', 13)).toBe('2026-10-05')
  })
})
