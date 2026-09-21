import { describe, expect, it } from 'vitest'
import { elapsedSince, formatClock, formatDuration, parseDuration } from './duration'

describe('parseDuration', () => {
  it('takes the shapes people actually type', () => {
    expect(parseDuration('1h 30m')).toBe(5400)
    expect(parseDuration('1h30m')).toBe(5400)
    expect(parseDuration('90m')).toBe(5400)
    expect(parseDuration('1.5h')).toBe(5400)
    expect(parseDuration(' 45M ')).toBe(2700)
  })

  it('reads a bare number as hours, the way a timesheet is said aloud', () => {
    expect(parseDuration('2')).toBe(7200)
    expect(parseDuration('0.25')).toBe(900)
  })

  it('refuses what is not a duration', () => {
    expect(parseDuration('')).toBeUndefined()
    expect(parseDuration('soon')).toBeUndefined()
    expect(parseDuration('0h 0m')).toBeUndefined()
    expect(parseDuration('1h 30')).toBeUndefined()
  })
})

describe('formatDuration', () => {
  it('says hours and minutes, never seconds', () => {
    expect(formatDuration(5400)).toBe('1h 30m')
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(2700)).toBe('45m')
    expect(formatDuration(0)).toBe('0m')
  })

  it('never goes backwards on a clock that drifted', () => {
    expect(formatDuration(-60)).toBe('0m')
  })
})

describe('elapsedSince', () => {
  it('counts from the start', () => {
    const now = new Date('2026-09-22T10:05:30.000Z')

    expect(elapsedSince('2026-09-22T10:00:00.000Z', now)).toBe(330)
  })

  it('reads a start in the future as nothing yet', () => {
    const now = new Date('2026-09-22T10:00:00.000Z')

    expect(elapsedSince('2026-09-22T10:05:00.000Z', now)).toBe(0)
  })
})

describe('formatClock', () => {
  it('ticks as a clock', () => {
    expect(formatClock(0)).toBe('0:00:00')
    expect(formatClock(252)).toBe('0:04:12')
    expect(formatClock(3725)).toBe('1:02:05')
  })
})
