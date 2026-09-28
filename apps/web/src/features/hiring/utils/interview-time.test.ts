import { describe, expect, it } from 'vitest'
import { formatInterviewTime, isTimeZone, timeZoneOptions } from './interview-time'

describe('interview times', () => {
  it('writes one instant in whichever zone the reader is in, naming it', () => {
    const at = '2026-10-14T02:00:00.000Z'

    expect(formatInterviewTime(at, 'Asia/Manila')).toBe('Wed, Oct 14, 10:00 AM (Asia/Manila)')
    expect(formatInterviewTime(at, 'America/Detroit')).toBe(
      'Tue, Oct 13, 10:00 PM (America/Detroit)',
    )
  })

  it('knows a real zone from a typo', () => {
    expect(isTimeZone('Asia/Manila')).toBe(true)
    expect(isTimeZone('Mars/Olympus')).toBe(false)
  })

  it('always offers the zone the reader is already in', () => {
    expect(timeZoneOptions('Asia/Manila')).toContain('Asia/Manila')
  })
})
