import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildNetlifyReport } from '../netlify-report'
import { REPORT_SITES, type ReportSite } from '../sites'
import { reportFileName, reportPdf } from './report-pdf'

const site = (key: string) => REPORT_SITES.find((one) => one.key === key) as ReportSite

const GA4 = {
  range: { start: '2026-10-25', end: '2026-11-24' },
  previous: { start: '2026-09-24', end: '2026-10-24' },
  timeZone: 'America/New_York',
  totals: {
    sessions: 218,
    totalUsers: 155,
    newUsers: 152,
    pageViews: 356,
    avgSessionSeconds: 103,
    engagementRate: 0.372,
    organicSearchVisits: 61,
    callsAndEmails: 0,
  },
  previousTotals: {
    sessions: 36,
    totalUsers: 23,
    newUsers: 23,
    pageViews: 67,
    avgSessionSeconds: 107,
    engagementRate: 0.36,
    organicSearchVisits: 2,
    callsAndEmails: 1,
  },
  sessionsByDay: Array.from({ length: 31 }, (_, index) => ({
    day: new Date(Date.UTC(2026, 9, 25 + index)).toISOString().slice(0, 10),
    sessions: index % 7,
    previousSessions: index % 3,
  })),
  channels: [{ channel: 'Direct', sessions: 149 }],
  landingPages: [
    { label: `/${'very-long-path/'.repeat(12)}`, sessions: 180, engagementRate: 0.43 },
  ],
  sources: [{ label: '(direct) / (none)', sessions: 149, engagementRate: 0.27 }],
  seo: null,
}

// The minus sign, thin spaces and an emoji are outside the PDF fonts and must not throw.
const TAKEAWAYS = {
  observations: 'Traffic volume: sessions rose −2% overall 🚀\n'.repeat(30),
  strengths: 'Fast pages: light.',
  improvements: '',
  recommendations: 'Grow search: add pages.\nCheck referrals: review them.',
}

const point = (label: string) =>
  `${label}: page views came mostly from people typing the address or using a bookmark.`
// A typical month: four observations, then two or three points per section.
const MONTH_OF_TAKEAWAYS = {
  observations: ['Traffic', 'Visitors', 'Direct', 'Busiest'].map(point).join('\n'),
  strengths: ['Fast', 'Known', 'Engaged'].map(point).join('\n'),
  improvements: ['Search', 'Spam', 'One page'].map(point).join('\n'),
  recommendations: ['Pages', 'Profile', 'Filter'].map(point).join('\n'),
}
const ten = <T>(make: (index: number) => T) => Array.from({ length: 10 }, (_, index) => make(index))

describe('reportPdf', () => {
  it('builds a GA4 report that runs onto more pages when the takeaways are long', async () => {
    const bytes = await reportPdf(site('palm-grove'), { source: 'ga4', report: GA4 }, TAKEAWAYS)

    const document = await PDFDocument.load(bytes)
    expect(document.getPageCount()).toBeGreaterThan(1)
  })

  it('builds a Netlify report, with or without takeaways or saved days', async () => {
    const empty = buildNetlifyReport(
      [],
      { start: '2026-10-25', end: '2026-11-24' },
      { start: '2026-09-24', end: '2026-10-24' },
    )

    const bytes = await reportPdf(
      site('rivers-residence'),
      { source: 'netlify', report: empty },
      null,
    )

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })

  it('keeps a full Netlify report with a month of takeaways on one page', async () => {
    const empty = buildNetlifyReport(
      [],
      { start: '2026-10-25', end: '2026-11-24' },
      { start: '2026-09-24', end: '2026-10-24' },
    )
    const ranked = (prefix: string) =>
      ten((index) => ({ label: `${prefix}-${index}`, count: 100 - index }))
    const bytes = await reportPdf(
      site('helping-with-moms-home'),
      {
        source: 'netlify',
        report: {
          ...empty,
          sources: ranked('source'),
          pages: ranked('/page'),
          countries: ranked('Country'),
        },
      },
      MONTH_OF_TAKEAWAYS,
    )

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })

  it('keeps a GA4 report with Google search and a month of takeaways on one page', async () => {
    const visits = (prefix: string) =>
      ten((index) => ({ label: `${prefix}-${index}`, sessions: 50 - index, engagementRate: 0.4 }))
    const report = {
      ...GA4,
      channels: ten((index) => ({ channel: `Channel ${index}`, sessions: 20 - index })),
      landingPages: visits('/page'),
      sources: visits('source / medium'),
      seo: {
        clicks: 33,
        impressions: 92,
        clickThroughRate: 0.359,
        averagePosition: 13.7,
        pages: ten((index) => ({
          page: `/page-${index}`,
          clicks: 9,
          impressions: 20,
          position: 4,
        })),
      },
    }

    const bytes = await reportPdf(site('palm-grove'), { source: 'ga4', report }, MONTH_OF_TAKEAWAYS)

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })

  it('names the file by site and dates', () => {
    expect(reportFileName(site('helping-with-moms-home'), '2026-10-25', '2026-11-24')).toBe(
      'Helping With Moms Home - Website Report - 2026-10-25 to 2026-11-24.pdf',
    )
  })
})
