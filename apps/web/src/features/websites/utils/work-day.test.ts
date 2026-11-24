import { describe, expect, it } from 'vitest'
import { shiftClock, shiftInstant, websiteDayKey } from './work-day'

const MANILA = 'Asia/Manila'

// Manila is UTC+8 all year, so 12:00Z is 20:00 there.
describe('websiteDayKey', () => {
  it('names an evening check after the day the shift starts', () => {
    expect(websiteDayKey(new Date('2026-11-05T12:00:00Z'), MANILA)).toBe('2026-11-05')
  })

  it('keeps a check after midnight on the shift that began the evening before', () => {
    expect(websiteDayKey(new Date('2026-11-04T18:50:00Z'), MANILA)).toBe('2026-11-04')
    expect(websiteDayKey(new Date('2026-11-04T21:19:00Z'), MANILA)).toBe('2026-11-04')
  })

  it('starts the next work day at noon', () => {
    expect(websiteDayKey(new Date('2026-11-05T03:59:00Z'), MANILA)).toBe('2026-11-04')
    expect(websiteDayKey(new Date('2026-11-05T04:00:00Z'), MANILA)).toBe('2026-11-05')
  })

  it('rolls back across a month boundary', () => {
    expect(websiteDayKey(new Date('2026-11-30T20:00:00Z'), MANILA)).toBe('2026-11-30')
    expect(websiteDayKey(new Date('2026-12-01T01:00:00Z'), MANILA)).toBe('2026-11-30')
  })
})

describe('shiftInstant', () => {
  it('reads an evening time on the day the shift began', () => {
    expect(shiftInstant('2026-11-04', '20:15', MANILA)?.toISOString()).toBe(
      '2026-11-04T12:15:00.000Z',
    )
  })

  it('reads a morning time on the day after, so it stays in the same shift', () => {
    const at = shiftInstant('2026-11-04', '03:30', MANILA)
    expect(at?.toISOString()).toBe('2026-11-04T19:30:00.000Z')
    expect(at && websiteDayKey(at, MANILA)).toBe('2026-11-04')
  })

  it('refuses a time that is not one', () => {
    expect(shiftInstant('2026-11-04', '25:00', MANILA)).toBeUndefined()
  })

  it('round-trips through shiftClock', () => {
    expect(shiftClock('2026-11-04T19:30:00.000Z', MANILA)).toBe('03:30')
  })
})
