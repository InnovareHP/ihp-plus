import { describe, expect, it } from 'vitest'
import type { Checklist, WebsiteCheckRow, WebsiteRow } from '../schema'
import { buildDayReport, dayReportFileName } from './day-report'

const ZONE = 'Asia/Manila'

function check(overrides: Partial<WebsiteCheckRow>): WebsiteCheckRow {
  return {
    status: 'up',
    httpStatus: 200,
    responseMs: 320,
    error: '',
    note: '',
    checkedByName: 'Ada Lovelace',
    // 8:05 PM in Manila on Nov 5.
    checkedAt: '2026-11-05T12:05:00.000Z',
    ...overrides,
  }
}

function site(name: string, checks: WebsiteRow['checks']): WebsiteRow {
  return {
    id: name,
    name,
    url: `https://${name.toLowerCase().replace(/\s/g, '')}.example`,
    clientId: '',
    clientName: '',
    notes: '',
    checks,
    snapshots: {},
    shift: { pagesButtons: undefined, findings: '', action: '' },
    formEmail: undefined,
  }
}

function checklist(websites: WebsiteRow[]): Checklist {
  return {
    date: '2026-11-05',
    today: '2026-11-05',
    timeZone: ZONE,
    snapshotsEnabled: false,
    websites,
  }
}

const generatedAt = new Date('2026-11-05T19:40:00.000Z')

const failedPages = {
  pagesButtons: 'fail' as const,
  findings: 'Book button does nothing',
  action: 'Ticket #4411',
}

describe('buildDayReport', () => {
  it('names the night shift across both dates in the organization’s zone', () => {
    const report = buildDayReport({ checklist: checklist([]), preparedBy: 'Ada', generatedAt })

    expect(report.shiftStart).toBe('Nov 5, 2026 · 8:00 PM')
    expect(report.shiftEnd).toBe('Nov 6, 2026 · 4:00 AM')
    expect(report.shiftHours).toBe('8:00 PM – 4:00 AM')
    expect(report.zoneLabel).toContain('GMT+8')
    expect(report.generatedAt).toBe('Nov 6, 2026 · 3:40 AM')
    expect(report.roundTimes).toEqual({ clock_in: 'Not run', clock_out: 'Not run' })
  })

  it('counts each round, leaving unchecked sites as their own column', () => {
    const report = buildDayReport({
      checklist: checklist([
        site('Alpha', { clock_in: check({}), clock_out: check({ status: 'down' }) }),
        site('Beta', { clock_in: check({ status: 'issue', note: 'Slow form' }) }),
        site('Gamma', {}),
      ]),
      preparedBy: 'Ada',
      generatedAt,
    })

    expect(report.summary.clock_in).toEqual({ up: 1, issue: 1, down: 0, unchecked: 1 })
    expect(report.summary.clock_out).toEqual({ up: 0, issue: 0, down: 1, unchecked: 2 })
    expect(report.roundTimes.clock_in).toBe('8:05 PM')
  })

  it('names each site with a problem and whether the shift ended with it fixed', () => {
    const report = buildDayReport({
      checklist: checklist([
        site('Alpha', {
          clock_in: check({ status: 'down', note: 'Host was down' }),
          clock_out: check({ checkedAt: '2026-11-05T19:30:00.000Z' }),
        }),
        site('Beta', { clock_in: check({ status: 'issue' }) }),
        { ...site('Gamma', { clock_in: check({}), clock_out: check({}) }), shift: failedPages },
        site('Delta', { clock_in: check({}), clock_out: check({}) }),
      ]),
      preparedBy: 'Ada',
      generatedAt,
    })

    expect(report.problems).toEqual([
      { website: 'Alpha', fixed: true },
      { website: 'Beta', fixed: false },
      { website: 'Gamma', fixed: false },
    ])
  })

  it('carries the lead’s own checks, findings and the latest form test', () => {
    const report = buildDayReport({
      checklist: checklist([
        {
          ...site('Alpha', { clock_in: check({}) }),
          shift: failedPages,
          formEmail: { result: 'pass', testedAt: '2026-11-02T13:00:00.000Z' },
        },
        site('Beta', {}),
      ]),
      preparedBy: 'Ada',
      generatedAt,
    })

    expect(report.sites[0]).toMatchObject({
      pagesButtons: 'fail',
      formEmail: { result: 'pass', testedOn: 'Nov 2' },
      findings: 'Book button does nothing',
      action: 'Ticket #4411',
    })
    expect(report.manual).toEqual({
      pagesPass: 0,
      pagesFail: 1,
      pagesUnchecked: 1,
      formTested: 1,
      formFailed: 0,
    })
  })

  it('marks a status the lead changed, so the reader knows it was not the checker', () => {
    const report = buildDayReport({
      checklist: checklist([
        site('Alpha', { clock_in: check({ status: 'issue', note: 'Blank page' }) }),
      ]),
      preparedBy: 'Ada',
      generatedAt,
    })

    expect(report.sites[0]?.rounds.clock_in?.overridden).toBe(true)
  })

  it('counts the days left on each domain and certificate it was given', () => {
    const report = buildDayReport({
      checklist: checklist([site('Alpha', {}), site('Beta', {})]),
      preparedBy: 'Ada',
      generatedAt,
      expiries: new Map([['Alpha', { domain: '2026-11-28T12:00:00.000Z', ssl: undefined }]]),
    })

    expect(report.hasExpiry).toBe(true)
    expect(report.sites[0]?.domain).toEqual({ at: 'Nov 28, 2026', days: 22 })
    expect(report.sites[0]?.ssl).toEqual({ at: undefined, days: undefined })
    expect(report.sites[1]?.domain.at).toBeUndefined()
  })

  it('names the person who checked by hand as IT lead, not the automatic run', () => {
    const report = buildDayReport({
      checklist: checklist([
        site('Alpha', { clock_in: check({ checkedByName: 'Automatic check' }) }),
        site('Beta', { clock_out: check({ checkedByName: 'Grace Hopper' }) }),
      ]),
      preparedBy: 'Ada',
      generatedAt,
    })

    expect(report.itLead).toBe('Grace Hopper')
  })

  it('falls back to whoever exported when nobody checked by hand', () => {
    const report = buildDayReport({ checklist: checklist([]), preparedBy: 'Ada', generatedAt })

    expect(report.itLead).toBe('Ada')
  })
})

describe('dayReportFileName', () => {
  it('names the file after the shift’s date', () => {
    expect(dayReportFileName('2026-11-05')).toBe('Daily-Website-Check-2026-11-05.pdf')
  })
})
