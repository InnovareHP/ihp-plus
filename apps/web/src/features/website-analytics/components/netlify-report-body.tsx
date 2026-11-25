'use client'

import { SimpleGrid, Stack, Text } from '@mantine/core'
import { changeOf, formatCount, formatDecimal, formatMegabytes, formatShortDay } from '../format'
import type { NetlifyCoverage, NetlifyReport, NetlifyRow } from '../netlify-report'
import { PeriodChart } from './period-chart'
import { ReportTable } from './report-table'
import { StatTile, type StatTileProps } from './stat-tile'

const complete = (coverage: NetlifyCoverage, key: 'visitorDays' | 'rankingDays') =>
  coverage[key] === coverage.days

function ranked(first: string) {
  return [
    { label: first, value: (row: NetlifyRow) => row.label },
    { label: 'Page views', value: (row: NetlifyRow) => formatCount(row.count), numeric: true },
  ]
}

export function NetlifyReportBody({ report }: { report: NetlifyReport }) {
  const { totals, previousTotals: before, coverage, previousCoverage } = report
  const visitorsComplete = complete(coverage, 'visitorDays')
  // Visitors only compare fairly when both periods were saved in full.
  const visitorsComparable = visitorsComplete && complete(previousCoverage, 'visitorDays')

  const tiles: StatTileProps[] = [
    {
      label: 'Page views',
      value: formatCount(totals.pageviews),
      change: changeOf(totals.pageviews, before.pageviews),
    },
    {
      label: 'Visitors',
      value: formatCount(totals.visitors),
      ...(visitorsComplete
        ? { change: visitorsComparable ? changeOf(totals.visitors, before.visitors) : null }
        : { note: `Counted for ${coverage.visitorDays} of ${coverage.days} days` }),
    },
    ...(visitorsComplete && totals.visitors > 0
      ? [
          {
            label: 'Pages per visitor',
            value: formatDecimal(totals.pageviews / totals.visitors),
          },
        ]
      : []),
    {
      label: 'Bandwidth',
      value: formatMegabytes(totals.bandwidthBytes),
      change: changeOf(totals.bandwidthBytes, before.bandwidthBytes),
    },
    ...(totals.pageviews > 0
      ? [
          {
            label: 'Per page view',
            value: formatMegabytes(totals.bandwidthBytes / totals.pageviews),
          },
        ]
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

  const rankingsComplete = complete(coverage, 'rankingDays')

  return (
    <Stack gap="xl">
      <SimpleGrid cols={{ base: 2, md: 3 }} spacing="md">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <PeriodChart
          metric="Page views"
          days={report.days.map((one) => ({
            day: one.day,
            current: one.pageviews,
            previous: one.previousPageviews,
          }))}
          total={totals.pageviews}
          previousTotal={before.pageviews}
        />
        <ReportTable
          caption="Top sources"
          rows={report.sources}
          rowKey={(row) => row.label}
          empty="No sources were saved for this range."
          columns={ranked('Source')}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <ReportTable
          caption="Top pages"
          rows={report.pages}
          rowKey={(row) => row.label}
          empty="No pages were saved for this range."
          columns={ranked('Page')}
        />
        <ReportTable
          caption="Top countries"
          rows={report.countries}
          rowKey={(row) => row.label}
          empty="No countries were saved for this range."
          columns={ranked('Country')}
        />
      </SimpleGrid>

      <Stack gap={4}>
        {rankingsComplete ? null : (
          <Text size="sm">
            Top sources, pages and countries cover {coverage.rankingDays} of the {coverage.days}{' '}
            days. Netlify keeps them for about a month, so earlier days were never saved.
          </Text>
        )}
        <Text size="sm">
          Days are counted in Michigan time. Visitors are added up day by day, so someone who came
          back on two days counts twice.
        </Text>
      </Stack>
    </Stack>
  )
}
