import { describe, expect, it, vi } from 'vitest'
import {
  formatInterviewTime,
  isTimeZone,
  slotOf,
  spreadAcrossDays,
  suggestionWindow,
  timeZoneOptions,
  viewerTimeZone,
} from './interview-time'

describe('interview times', () => {
  it('uses the device zone, and the fallback when the runtime names none it knows', () => {
    const resolved = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    resolved.mockReturnValue({ timeZone: 'America/New_York' } as Intl.ResolvedDateTimeFormatOptions)
    expect(viewerTimeZone('Asia/Manila')).toBe('America/New_York')
    resolved.mockReturnValue({ timeZone: 'Not/AZone' } as Intl.ResolvedDateTimeFormatOptions)
    expect(viewerTimeZone('Asia/Manila')).toBe('Asia/Manila')
    resolved.mockRestore()
  })

  it('writes one instant in whichever zone the reader is in, naming it', () => {
    const at = '2026-10-14T02:00:00.000Z'

    expect(formatInterviewTime(at, 'Asia/Manila')).toBe('Wed, Oct 14, 10:00 AM (Asia/Manila)')
    expect(formatInterviewTime(at, 'America/Detroit')).toBe(
      'Tue, Oct 13, 10:00 PM (America/Detroit)',
    )
  })

  it('turns an instant into the day and time the offer form holds', () => {
    expect(slotOf('2030-10-14T02:00:00.000Z', 'Asia/Manila')).toEqual({
      date: '2030-10-14',
      time: '10:00',
    })
  })

  it('takes the earliest free time from each of the first few days', () => {
    const starts = [
      '2030-10-15T06:00:00.000Z',
      '2030-10-14T03:00:00.000Z',
      '2030-10-14T01:00:00.000Z',
      '2030-10-16T02:00:00.000Z',
    ]

    expect(spreadAcrossDays(starts, 'Asia/Manila', 2)).toEqual([
      { date: '2030-10-14', time: '09:00' },
      { date: '2030-10-15', time: '14:00' },
    ])
  })

  it('reads two weeks ahead from today in the organization zone', () => {
    // 20:00 UTC on the 13th is already the 14th in Manila.
    expect(suggestionWindow('Asia/Manila', new Date('2030-10-13T20:00:00.000Z'))).toEqual({
      fromDate: '2030-10-14',
      toDate: '2030-10-28',
    })
  })

  it('knows a real zone from a typo', () => {
    expect(isTimeZone('Asia/Manila')).toBe(true)
    expect(isTimeZone('Mars/Olympus')).toBe(false)
  })

  it('always offers the zone the reader is already in', () => {
    expect(timeZoneOptions('Asia/Manila')).toContain('Asia/Manila')
  })
})
