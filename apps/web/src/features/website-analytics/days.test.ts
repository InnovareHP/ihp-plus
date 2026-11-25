import { describe, expect, it } from 'vitest'
import { dayKeyOf, dayStart, daysIn, lastDays, offsetOf, previousRange, shiftDay } from './days'

const DETROIT = 'America/Detroit'

describe('dayKeyOf', () => {
  it('names the day in the zone, not in UTC', () => {
    expect(dayKeyOf(new Date('2026-11-25T03:00:00Z'), DETROIT)).toBe('2026-11-24')
    expect(dayKeyOf(new Date('2026-11-25T06:00:00Z'), DETROIT)).toBe('2026-11-25')
  })
})

describe('shiftDay', () => {
  it('crosses month and year ends', () => {
    expect(shiftDay('2026-11-30', 1)).toBe('2026-12-01')
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31')
  })
})

describe('offsetOf', () => {
  it('follows daylight saving', () => {
    expect(offsetOf(new Date('2026-11-25T12:00:00Z'), DETROIT)).toBe('-0500')
    expect(offsetOf(new Date('2026-07-01T12:00:00Z'), DETROIT)).toBe('-0400')
    expect(offsetOf(new Date('2026-07-01T12:00:00Z'), 'UTC')).toBe('+0000')
  })
})

describe('dayStart', () => {
  it('is local midnight in winter and summer', () => {
    expect(dayStart('2026-11-25', DETROIT).toISOString()).toBe('2026-11-25T05:00:00.000Z')
    expect(dayStart('2026-07-01', DETROIT).toISOString()).toBe('2026-07-01T04:00:00.000Z')
  })

  it('is local midnight on the day the clocks go back', () => {
    expect(dayStart('2026-11-01', DETROIT).toISOString()).toBe('2026-11-01T04:00:00.000Z')
    expect(dayStart('2026-11-02', DETROIT).toISOString()).toBe('2026-11-02T05:00:00.000Z')
  })
})

describe('lastDays', () => {
  it('lists whole days before today, oldest first', () => {
    expect(lastDays(3, new Date('2026-11-25T12:00:00Z'), DETROIT)).toEqual([
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
    ])
  })
})

describe('previousRange', () => {
  it('is the same length, ending the day before', () => {
    expect(daysIn({ start: '2026-11-01', end: '2026-11-30' })).toBe(30)
    expect(previousRange({ start: '2026-11-01', end: '2026-11-30' })).toEqual({
      start: '2026-10-02',
      end: '2026-10-31',
    })
    expect(previousRange({ start: '2026-11-25', end: '2026-11-25' })).toEqual({
      start: '2026-11-24',
      end: '2026-11-24',
    })
  })
})
