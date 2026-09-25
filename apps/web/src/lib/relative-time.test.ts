import { describe, expect, it } from 'vitest'
import { describeMoment, relativeTo } from './relative-time'

const NOW = new Date('2026-09-21T12:00:00.000Z')

describe('relativeTo', () => {
  it('reads as just now inside the first minute', () => {
    expect(relativeTo('2026-09-21T11:59:30.000Z', NOW)).toBe('just now')
  })

  it('names the largest unit that fits', () => {
    expect(relativeTo('2026-09-21T11:30:00.000Z', NOW)).toBe('30 minutes ago')
    expect(relativeTo('2026-09-19T12:00:00.000Z', NOW)).toBe('2 days ago')
    expect(relativeTo('2025-09-21T12:00:00.000Z', NOW)).toBe('last year')
  })

  it('reads forward for a moment still to come', () => {
    expect(relativeTo('2026-09-23T12:00:00.000Z', NOW)).toBe('in 2 days')
  })
})

describe('describeMoment', () => {
  it('keeps the absolute date and adds the hint', () => {
    expect(describeMoment('2026-09-19T12:00:00.000Z', NOW)).toContain('Sep 19, 2026')
    expect(describeMoment('2026-09-19T12:00:00.000Z', NOW)).toContain('· 2 days ago')
  })
})
