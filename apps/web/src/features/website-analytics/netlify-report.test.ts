import { describe, expect, it } from 'vitest'
import { buildNetlifyReport, type SavedDay } from './netlify-report'

const RANGE = { start: '2026-11-01', end: '2026-11-03' }
const PREVIOUS = { start: '2026-10-29', end: '2026-10-31' }

function day(dayKey: string, over: Partial<SavedDay> = {}): SavedDay {
  return {
    day: dayKey,
    pageviews: 10,
    visitors: 6,
    bandwidthBytes: 1_000_000,
    sources: [
      { resource: '', count: 7 },
      { resource: 'google.com', count: 3 },
    ],
    pages: [{ resource: '/', count: 10 }],
    countries: [{ resource: 'US', count: 9, label: 'United States' }],
    ...over,
  }
}

describe('buildNetlifyReport', () => {
  it('adds the range up and compares it with the days before', () => {
    const report = buildNetlifyReport(
      [
        day('2026-10-30', { pageviews: 4, visitors: 2 }),
        day('2026-11-01'),
        day('2026-11-02', { pageviews: 30, visitors: 20 }),
        day('2026-11-03'),
      ],
      RANGE,
      PREVIOUS,
    )

    expect(report.totals).toEqual({ pageviews: 50, visitors: 32, bandwidthBytes: 3_000_000 })
    expect(report.previousTotals).toEqual({ pageviews: 4, visitors: 2, bandwidthBytes: 1_000_000 })
    expect(report.busiest).toEqual({ day: '2026-11-02', pageviews: 30 })
    expect(report.days).toEqual([
      { day: '2026-11-01', pageviews: 10, previousPageviews: 0 },
      { day: '2026-11-02', pageviews: 30, previousPageviews: 4 },
      { day: '2026-11-03', pageviews: 10, previousPageviews: 0 },
    ])
  })

  it('merges the daily top lists and names direct visits', () => {
    const report = buildNetlifyReport(
      [day('2026-11-01'), day('2026-11-02', { sources: [{ resource: 'bing.com', count: 20 }] })],
      RANGE,
      PREVIOUS,
    )

    expect(report.sources).toEqual([
      { label: 'bing.com', count: 20 },
      { label: 'Direct', count: 7 },
      { label: 'google.com', count: 3 },
    ])
    expect(report.countries).toEqual([{ label: 'United States', count: 18 }])
  })

  it('counts the days Netlify had already forgotten as gaps, not as quiet days', () => {
    const report = buildNetlifyReport(
      [
        day('2026-11-01', { visitors: 0, sources: [], pages: [], countries: [] }),
        day('2026-11-02', { pageviews: 0, visitors: 0, sources: [], pages: [], countries: [] }),
        day('2026-11-03'),
      ],
      RANGE,
      PREVIOUS,
    )

    expect(report.coverage).toEqual({ days: 3, savedDays: 3, visitorDays: 2, rankingDays: 2 })
    expect(report.previousCoverage).toEqual({
      days: 3,
      savedDays: 0,
      visitorDays: 0,
      rankingDays: 0,
    })
  })

  it('ignores saved lists that are not the shape it expects', () => {
    const report = buildNetlifyReport(
      [day('2026-11-01', { pages: 'nope', sources: [{ resource: 1 }] })],
      RANGE,
      PREVIOUS,
    )

    expect(report.pages).toEqual([])
    expect(report.sources).toEqual([])
  })
})
