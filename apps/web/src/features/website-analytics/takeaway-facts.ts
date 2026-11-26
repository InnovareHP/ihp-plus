import {
  changeOf,
  formatChange,
  formatCount,
  formatDecimal,
  formatDuration,
  formatMegabytes,
  formatPercent,
  formatShortDay,
} from './format'
import type { Ga4Report } from './ga4'
import type { NetlifyReport } from './netlify-report'
import { rangeLabel } from './report-range'
import type { ReportSite } from './sites'

function line(label: string, now: number, before: number, show: (value: number) => string) {
  const change = changeOf(now, before)
  const compared =
    change === null ? 'no earlier data' : `previous period ${show(before)}, ${formatChange(change)}`
  return `- ${label}: ${show(now)} (${compared})`
}

function ranked(title: string, rows: { label: string; value: string }[]) {
  if (rows.length === 0) return `${title}: none recorded`
  return `${title}:\n${rows.map((row) => `- ${row.label}: ${row.value}`).join('\n')}`
}

/** The GA4 report as plain facts, formatted exactly as the screen and PDF show them. */
export function ga4Facts(site: ReportSite, report: Ga4Report): string {
  const { totals: now, previousTotals: before } = report
  const busiest = report.sessionsByDay.reduce(
    (top, day) => (day.sessions > top.sessions ? day : top),
    { day: '', sessions: 0, previousSessions: 0 },
  )
  const parts = [
    `Website: ${site.name}`,
    `Period: ${rangeLabel(report.range)}, compared with ${rangeLabel(report.previous)}`,
    'Source: Google Analytics',
    [
      'Totals:',
      line('Sessions', now.sessions, before.sessions, formatCount),
      line('Total users', now.totalUsers, before.totalUsers, formatCount),
      line('New users', now.newUsers, before.newUsers, formatCount),
      line('Page views', now.pageViews, before.pageViews, formatCount),
      line(
        'Organic search visits',
        now.organicSearchVisits,
        before.organicSearchVisits,
        formatCount,
      ),
      line('Average time on site', now.avgSessionSeconds, before.avgSessionSeconds, formatDuration),
      line('Engagement rate', now.engagementRate, before.engagementRate, formatPercent),
      ...(now.callsAndEmails === null
        ? []
        : [line('Calls and emails', now.callsAndEmails, before.callsAndEmails ?? 0, formatCount)]),
    ].join('\n'),
    busiest.sessions > 0
      ? `Busiest day: ${formatShortDay(busiest.day)} with ${formatCount(busiest.sessions)} sessions`
      : '',
    ranked(
      'Sessions by channel',
      report.channels.map((row) => ({ label: row.channel, value: formatCount(row.sessions) })),
    ),
    ranked(
      'Top landing pages (sessions, engagement)',
      report.landingPages.map((row) => ({
        label: row.label || '(not set)',
        value: `${formatCount(row.sessions)}, ${formatPercent(row.engagementRate)}`,
      })),
    ),
    ranked(
      'Top sources (sessions, engagement)',
      report.sources.map((row) => ({
        label: row.label || '(not set)',
        value: `${formatCount(row.sessions)}, ${formatPercent(row.engagementRate)}`,
      })),
    ),
  ]
  if (site.seo) {
    parts.push(
      report.seo
        ? [
            'Google search (Search Console):',
            `- Clicks: ${formatCount(report.seo.clicks)}`,
            `- Impressions: ${formatCount(report.seo.impressions)}`,
            `- Click-through rate: ${formatPercent(report.seo.clickThroughRate)}`,
            `- Average position: ${formatDecimal(report.seo.averagePosition)}`,
            ranked(
              'Top pages in Google search (clicks, impressions)',
              report.seo.pages.map((page) => ({
                label: page.page,
                value: `${formatCount(page.clicks)}, ${formatCount(page.impressions)}`,
              })),
            ),
          ].join('\n')
        : 'Google search: no data for this period yet',
    )
  }
  return parts.filter(Boolean).join('\n\n')
}

/** The Netlify report as plain facts, saying where days are missing so no gap reads as a drop. */
export function netlifyFacts(site: ReportSite, report: NetlifyReport): string {
  const { totals: now, previousTotals: before, coverage, previousCoverage } = report
  const visitorsComplete = coverage.visitorDays === coverage.days
  const visitorsComparable =
    visitorsComplete && previousCoverage.visitorDays === previousCoverage.days
  const rankingsNote =
    coverage.rankingDays === coverage.days
      ? ''
      : ` (covers ${coverage.rankingDays} of ${coverage.days} days)`

  return [
    `Website: ${site.name}`,
    `Period: ${rangeLabel(report.range)}, compared with ${rangeLabel(report.previous)}`,
    'Source: Netlify Analytics (no Google Search Console data for this site)',
    [
      'Totals:',
      line('Page views', now.pageviews, before.pageviews, formatCount),
      visitorsComparable
        ? line('Unique visitors (added up day by day)', now.visitors, before.visitors, formatCount)
        : `- Unique visitors (added up day by day): ${formatCount(now.visitors)} (${
            visitorsComplete
              ? 'no comparable earlier data'
              : `counted for ${coverage.visitorDays} of ${coverage.days} days only`
          })`,
      visitorsComplete && now.visitors > 0
        ? `- Page views per visitor: ${formatDecimal(now.pageviews / now.visitors)}`
        : '',
      line('Bandwidth', now.bandwidthBytes, before.bandwidthBytes, formatMegabytes),
      now.pageviews > 0
        ? `- Bandwidth per page view: ${formatMegabytes(now.bandwidthBytes / now.pageviews)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    report.busiest
      ? `Busiest day: ${formatShortDay(report.busiest.day)} with ${formatCount(report.busiest.pageviews)} page views`
      : '',
    ranked(
      `Top sources by page views${rankingsNote}`,
      report.sources.map((row) => ({ label: row.label, value: formatCount(row.count) })),
    ),
    ranked(
      `Top pages by page views${rankingsNote}`,
      report.pages.map((row) => ({ label: row.label, value: formatCount(row.count) })),
    ),
    ranked(
      `Top countries by page views${rankingsNote}`,
      report.countries.map((row) => ({ label: row.label, value: formatCount(row.count) })),
    ),
  ]
    .filter(Boolean)
    .join('\n\n')
}
