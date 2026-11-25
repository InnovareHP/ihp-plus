import { describe, expect, it } from 'vitest'
import {
  changeOf,
  formatChange,
  formatCount,
  formatDuration,
  formatPercent,
  formatShortDay,
} from './format'

describe('format', () => {
  it('writes numbers the way the report reads', () => {
    expect(formatCount(1234.4)).toBe('1,234')
    expect(formatPercent(0.3229)).toBe('32.3%')
    expect(formatDuration(92.5)).toBe('1m 32s')
    expect(formatDuration(41)).toBe('41s')
    expect(formatShortDay('2026-11-03')).toBe('Nov 3')
  })

  it('compares against the period before, and says nothing when it was empty', () => {
    expect(changeOf(96, 40)).toBeCloseTo(1.4)
    expect(changeOf(5, 0)).toBeNull()
    expect(formatChange(1.4)).toBe('+140%')
    expect(formatChange(-0.25)).toBe('−25%')
    expect(formatChange(0)).toBe('0%')
  })
})
