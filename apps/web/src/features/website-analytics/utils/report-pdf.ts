import {
  changeOf,
  formatChange,
  formatCount,
  formatDecimal,
  formatDuration,
  formatMegabytes,
  formatPercent,
  formatShortDay,
} from '../format'
import type { Ga4Report } from '../ga4'
import type { NetlifyReport } from '../netlify-report'
import { rangeLabel } from '../report-range'
import {
  pointsOf,
  splitLead,
  TAKEAWAY_LABELS,
  TAKEAWAY_SECTIONS,
  type TakeawaySection,
  type TakeawaysValues,
} from '../schema'
import type { SiteReport } from '../service'
import type { ReportSite } from '../sites'
import { createWriter, PDF_COLORS, type Area, type PdfWriter, type Run } from './pdf-writer'

// Five rows per list keep each report on one page.
const TOP_ROWS = 5
const TABLE_HEIGHT = 16 + 14 * (TOP_ROWS + 1) + 12

const changeNote = (now: number, before: number) => {
  const change = changeOf(now, before)
  return change === null ? 'No earlier data' : `${formatChange(change)} vs previous`
}

function takeawaySection(
  writer: PdfWriter,
  takeaways: TakeawaysValues,
  key: TakeawaySection,
  { size, headingSize, ...area }: { size: number; headingSize: number } & Area,
) {
  const points = pointsOf(takeaways[key])
  if (points.length === 0) return
  writer.heading(TAKEAWAY_LABELS[key], headingSize, { before: 3, gap: 3, ...area })
  points.forEach((point, index) => {
    const { lead, rest } = splitLead(point)
    const runs: Run[] = lead
      ? [{ text: `${lead}: `, bold: true }, { text: rest }]
      : [{ text: rest }]
    writer.paragraph(runs, {
      indent: 16,
      marker: key === 'recommendations' ? `${index + 1}.` : '•',
      gap: 2,
      size,
      ...area,
    })
  })
}

/** The takeaways in one column, or in two when that is what keeps the report on one page. */
function takeawaysBlock(writer: PdfWriter, takeaways: TakeawaysValues | null, columns: 1 | 2) {
  if (!takeaways) return
  const sizes = { size: 9, headingSize: 11 }
  if (columns === 1) {
    for (const key of TAKEAWAY_SECTIONS) takeawaySection(writer, takeaways, key, sizes)
  } else {
    const halves = [TAKEAWAY_SECTIONS.slice(0, 2), TAKEAWAY_SECTIONS.slice(2)]
    writer.sideBySide(
      60,
      halves.map(
        (keys) => (area) =>
          keys.forEach((key) => takeawaySection(writer, takeaways, key, { ...sizes, ...area })),
      ),
    )
  }
  writer.space(4)
}

function ga4Body(
  writer: PdfWriter,
  site: ReportSite,
  report: Ga4Report,
  takeaways: TakeawaysValues | null,
  columns: 1 | 2,
) {
  const { totals: now, previousTotals: before, seo } = report
  const tiles = [
    {
      label: 'Organic visits',
      value: formatCount(now.organicSearchVisits),
      note: changeNote(now.organicSearchVisits, before.organicSearchVisits),
    },
    {
      label: 'New users',
      value: formatCount(now.newUsers),
      note: changeNote(now.newUsers, before.newUsers),
    },
    {
      label: 'Page views',
      value: formatCount(now.pageViews),
      note: changeNote(now.pageViews, before.pageViews),
    },
    {
      label: 'Avg. visit time',
      value: formatDuration(now.avgSessionSeconds),
      note: changeNote(now.avgSessionSeconds, before.avgSessionSeconds),
    },
    {
      label: 'Total users',
      value: formatCount(now.totalUsers),
      note: changeNote(now.totalUsers, before.totalUsers),
    },
    {
      label: 'Sessions',
      value: formatCount(now.sessions),
      note: changeNote(now.sessions, before.sessions),
    },
    {
      label: 'Engagement rate',
      value: formatPercent(now.engagementRate),
      note: changeNote(now.engagementRate, before.engagementRate),
    },
    ...(now.callsAndEmails === null
      ? []
      : [
          {
            label: 'Calls & emails',
            value: formatCount(now.callsAndEmails),
            note: changeNote(now.callsAndEmails, before.callsAndEmails ?? 0),
          },
        ]),
    ...(site.seo && seo
      ? [
          // Plain meanings instead of change notes, since clients rarely know these search terms.
          { label: 'Google clicks', value: formatCount(seo.clicks), note: 'Visits from Google' },
          {
            label: 'Impressions',
            value: formatCount(seo.impressions),
            note: 'Times seen in Google',
          },
          {
            label: 'Click rate',
            value: formatPercent(seo.clickThroughRate),
            note: 'Seen, then clicked',
          },
          {
            label: 'Avg. position',
            value: formatDecimal(seo.averagePosition),
            note: '1 is the top result',
          },
        ]
      : []),
  ]
  writer.heading('Key numbers')
  writer.tiles(tiles, tiles.length > 8 ? 6 : 4, { height: 46, valueSize: 14, noteSize: 6.8 })
  if (site.seo && !seo) {
    writer.paragraph([{ text: 'Google has no search data for this period yet.' }], { size: 9 })
  }

  takeawaysBlock(writer, takeaways, columns)

  const channels = report.channels.slice(0, TOP_ROWS + 1)
  writer.sideBySide(Math.max(150, 16 * channels.length + 30), [
    (area) =>
      writer.lineChart(
        'Sessions per day',
        report.sessionsByDay.map((day) => ({
          label: formatShortDay(day.day),
          current: day.sessions,
          previous: day.previousSessions,
        })),
        { ...area, height: 85 },
      ),
    (area) =>
      writer.barList(
        'Sessions by channel',
        channels.map((row) => ({
          label: row.channel,
          value: row.sessions,
          shown: formatCount(row.sessions),
        })),
        area,
      ),
  ])

  const sessionColumn = {
    header: 'Sessions',
    width: 1.4,
    numeric: true,
    value: (row: { sessions: number }) => formatCount(row.sessions),
  }
  const rowColumns = (first: string, withEngagement: boolean) => [
    { header: first, width: 3.2, value: (row: { label: string }) => row.label || '(not set)' },
    sessionColumn,
    ...(withEngagement
      ? [
          {
            header: 'Engagement',
            width: 1.9,
            numeric: true,
            value: (row: { engagementRate: number }) => formatPercent(row.engagementRate),
          },
        ]
      : []),
  ]
  const searchPages = site.seo && seo ? seo.pages : null
  // With Google data there are three lists, so each keeps only its main count to fit one row.
  const compact = { rowHeight: 14 }
  writer.sideBySide(TABLE_HEIGHT, [
    (area) =>
      writer.table(
        'Top landing pages',
        rowColumns('Page', !searchPages),
        report.landingPages.slice(0, TOP_ROWS),
        'No pages were visited.',
        { ...area, ...compact },
      ),
    (area) =>
      writer.table(
        'Top sources',
        rowColumns('Source / medium', !searchPages),
        report.sources.slice(0, TOP_ROWS),
        'No visits.',
        { ...area, ...compact },
      ),
    ...(searchPages
      ? [
          (area: Required<Area>) =>
            writer.table(
              'Top Google search pages',
              [
                { header: 'Page', width: 3.2, value: (row: { page: string }) => row.page },
                {
                  header: 'Clicks',
                  width: 1.4,
                  numeric: true,
                  value: (row: { clicks: number }) => formatCount(row.clicks),
                },
              ],
              searchPages.slice(0, TOP_ROWS),
              'None yet.',
              { ...area, ...compact },
            ),
        ]
      : []),
  ])

  writer.paragraph(
    [
      {
        text: `Source: Google Analytics. Days are counted in ${report.timeZone.replace('_', ' ') || 'the property’s time zone'}.`,
        color: PDF_COLORS.muted,
      },
    ],
    { size: 7.5 },
  )
}

function netlifyBody(
  writer: PdfWriter,
  report: NetlifyReport,
  takeaways: TakeawaysValues | null,
  columns: 1 | 2,
) {
  const { totals: now, previousTotals: before, coverage, previousCoverage } = report
  const visitorsComplete = coverage.visitorDays === coverage.days
  const visitorsComparable =
    visitorsComplete && previousCoverage.visitorDays === previousCoverage.days

  const tiles = [
    {
      label: 'Page views',
      value: formatCount(now.pageviews),
      note: changeNote(now.pageviews, before.pageviews),
    },
    {
      label: 'Visitors',
      value: formatCount(now.visitors),
      note: visitorsComplete
        ? visitorsComparable
          ? changeNote(now.visitors, before.visitors)
          : 'No earlier data'
        : `Only ${coverage.visitorDays} of ${coverage.days} days`,
    },
    ...(visitorsComplete && now.visitors > 0
      ? [{ label: 'Pages per visitor', value: formatDecimal(now.pageviews / now.visitors) }]
      : []),
    {
      label: 'Bandwidth',
      value: formatMegabytes(now.bandwidthBytes),
      note: changeNote(now.bandwidthBytes, before.bandwidthBytes),
    },
    ...(now.pageviews > 0
      ? [{ label: 'Per page view', value: formatMegabytes(now.bandwidthBytes / now.pageviews) }]
      : []),
    ...(report.busiest
      ? [
          {
            label: 'Busiest day',
            value: formatShortDay(report.busiest.day),
            note: `${formatCount(report.busiest.pageviews)} page views`,
          },
        ]
      : []),
  ]
  writer.heading('Key numbers')
  writer.tiles(tiles, tiles.length, { height: 46, valueSize: 14, noteSize: 6.8 })

  takeawaysBlock(writer, takeaways, columns)

  writer.lineChart(
    'Page views per day',
    report.days.map((day) => ({
      label: formatShortDay(day.day),
      current: day.pageviews,
      previous: day.previousPageviews,
    })),
    { height: 95 },
  )
  const ranked = (first: string) => [
    { header: first, width: 3.2, value: (row: { label: string }) => row.label },
    {
      header: 'Views',
      width: 1,
      numeric: true,
      value: (row: { count: number }) => formatCount(row.count),
    },
  ]
  const lists = [
    { caption: 'Top sources', first: 'Source', rows: report.sources, empty: 'None saved.' },
    { caption: 'Top pages', first: 'Page', rows: report.pages, empty: 'None saved.' },
    { caption: 'Top countries', first: 'Country', rows: report.countries, empty: 'None saved.' },
  ]
  writer.sideBySide(
    TABLE_HEIGHT,
    lists.map(
      (list) => (area) =>
        writer.table(list.caption, ranked(list.first), list.rows.slice(0, TOP_ROWS), list.empty, {
          ...area,
          rowHeight: 14,
        }),
    ),
  )

  const notes = [
    'Source: Netlify Analytics. Days are counted in Michigan time. Visitors are added up day by day, so someone who came back on two days counts twice.',
  ]
  if (coverage.rankingDays < coverage.days) {
    notes.push(
      `Top sources, pages and countries cover ${coverage.rankingDays} of the ${coverage.days} days; Netlify keeps them for about a month.`,
    )
  }
  for (const note of notes) {
    writer.paragraph([{ text: note, color: PDF_COLORS.muted }], { size: 7.5, gap: 1 })
  }
}

async function buildReport(
  site: ReportSite,
  read: SiteReport,
  takeaways: TakeawaysValues | null,
  columns: 1 | 2,
) {
  const writer = await createWriter()
  const { range, previous } = read.report
  writer.paragraph([{ text: `${site.name} Website Report`, bold: true, color: PDF_COLORS.navy }], {
    size: 18,
    gap: 2,
  })
  writer.paragraph(
    [
      {
        text: `${rangeLabel(range)}, compared with ${rangeLabel(previous)}`,
        color: PDF_COLORS.muted,
      },
    ],
    { size: 10, gap: 8 },
  )

  if (read.source === 'ga4') ga4Body(writer, site, read.report, takeaways, columns)
  else netlifyBody(writer, read.report, takeaways, columns)
  return writer
}

/** One site's report as a PDF, without the letterhead, which is stamped on afterwards. */
export async function reportPdf(
  site: ReportSite,
  read: SiteReport,
  takeaways: TakeawaysValues | null,
): Promise<Uint8Array> {
  const single = await buildReport(site, read, takeaways, 1)
  if (single.pageCount() === 1) return single.save()
  // Two columns of takeaways are the last squeeze; when even they overflow, one clean column runs on.
  const split = await buildReport(site, read, takeaways, 2)
  return (split.pageCount() === 1 ? split : single).save()
}

/** A file name that sorts by site and says which dates it covers. */
export function reportFileName(site: ReportSite, start: string, end: string) {
  const name = site.name.replace(/[^\w\s-]/g, '').trim()
  return `${name} - Website Report - ${start} to ${end}.pdf`
}
