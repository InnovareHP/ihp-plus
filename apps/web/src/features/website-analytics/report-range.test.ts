import { describe, expect, it } from 'vitest'
import {
  customRangeProblem,
  presetRange,
  rangeLabel,
  reportQueryOf,
  reportViewOf,
} from './report-range'

const TODAY = '2026-11-26'
const NONE = { site: null, range: null, from: null, to: null }

describe('presetRange', () => {
  it('ends yesterday and counts back whole days', () => {
    expect(presetRange('30d', TODAY)).toEqual({ start: '2026-10-27', end: '2026-11-25' })
    expect(presetRange('60d', TODAY)).toEqual({ start: '2026-09-27', end: '2026-11-25' })
    expect(presetRange('7d', TODAY)).toEqual({ start: '2026-11-19', end: '2026-11-25' })
  })

  it('takes last month as the whole calendar month before this one', () => {
    expect(presetRange('last-month', TODAY)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(presetRange('last-month', '2027-01-01')).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
    })
  })
})

describe('reportViewOf', () => {
  it('opens on the first site and the last 30 days', () => {
    const view = reportViewOf(NONE, TODAY)

    expect(view.site.key).toBe('palm-grove')
    expect(view.preset).toBe('30d')
    expect(view.range).toEqual({ start: '2026-10-27', end: '2026-11-25' })
    expect(view.previous).toEqual({ start: '2026-09-27', end: '2026-10-26' })
  })

  it('reads the site and a custom range from the address', () => {
    const view = reportViewOf(
      { site: 'magnolia', range: 'custom', from: '2026-10-01', to: '2026-10-31' },
      TODAY,
    )

    expect(view.site.key).toBe('magnolia')
    expect(view.preset).toBe('custom')
    expect(view.range).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(view.previous).toEqual({ start: '2026-08-31', end: '2026-09-30' })
  })

  it('reads a named preset from the address', () => {
    const view = reportViewOf({ ...NONE, range: 'last-month' }, TODAY)
    expect(view.preset).toBe('last-month')
    expect(view.range).toEqual({ start: '2026-10-01', end: '2026-10-31' })
  })

  it('falls back to 30 days for an unknown site or a range it cannot show', () => {
    for (const bad of [
      { from: '2026-10-31', to: '2026-10-01' },
      { from: '2026-02-30', to: '2026-10-01' },
      { from: '2026-10-01', to: TODAY },
      { from: 'soon', to: '2026-10-01' },
    ]) {
      const view = reportViewOf({ site: 'nope', range: 'custom', ...bad }, TODAY)
      expect(view.site.key).toBe('palm-grove')
      expect(view.preset).toBe('30d')
    }
  })
})

describe('customRangeProblem', () => {
  it('names what is wrong with a range', () => {
    expect(customRangeProblem({ start: '2026-10-01', end: '2026-10-31' }, TODAY)).toBeNull()
    expect(customRangeProblem({ start: '2026-08-01', end: '2026-10-31' }, TODAY)).toBe(
      'Reports start on Sep 1, 2026.',
    )
    expect(customRangeProblem({ start: '2026-11-01', end: TODAY }, TODAY)).toMatch(/yesterday/)
    expect(customRangeProblem({ start: '2026-09-01', end: '2027-11-01' }, '2027-12-01')).toMatch(
      /a year or less/,
    )
  })
})

describe('reportQueryOf', () => {
  it('keeps the address short for the defaults', () => {
    expect(reportQueryOf({ siteKey: 'palm-grove', preset: '30d' }).toString()).toBe(
      'tab=analytics&site=palm-grove',
    )
    expect(reportQueryOf({ siteKey: 'magnolia', preset: 'last-month' }).toString()).toBe(
      'tab=analytics&site=magnolia&range=last-month',
    )
    expect(
      reportQueryOf({
        siteKey: 'nbphs',
        preset: 'custom',
        range: { start: '2026-10-01', end: '2026-10-31' },
      }).toString(),
    ).toBe('tab=analytics&site=nbphs&range=custom&from=2026-10-01&to=2026-10-31')
  })
})

describe('rangeLabel', () => {
  it('reads like a date, not a key', () => {
    expect(rangeLabel({ start: '2026-10-01', end: '2026-10-31' })).toBe('Oct 1 – 31, 2026')
    expect(rangeLabel({ start: '2026-10-27', end: '2026-11-25' })).toBe('Oct 27 – Nov 25, 2026')
  })
})
