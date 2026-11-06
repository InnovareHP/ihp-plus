import { describe, expect, it } from 'vitest'
import { websiteDayKey } from './work-day'

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
