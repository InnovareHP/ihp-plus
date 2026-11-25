'use client'

import { SimpleGrid, Stack, Text } from '@mantine/core'
import type { Ga4Report, Ga4Row } from '../ga4'
import { changeOf, formatCount, formatDuration, formatPercent } from '../format'
import type { ReportSite } from '../sites'
import { ChannelsChart } from './channels-chart'
import { ReportTable } from './report-table'
import { PeriodChart } from './period-chart'
import { SeoSection } from './seo-section'
import { StatTile } from './stat-tile'

const ROW_COLUMNS = (first: string) => [
  { label: first, value: (row: Ga4Row) => row.label || '(not set)' },
  { label: 'Sessions', value: (row: Ga4Row) => formatCount(row.sessions), numeric: true },
  {
    label: 'Engagement',
    value: (row: Ga4Row) => formatPercent(row.engagementRate),
    numeric: true,
  },
]

export interface Ga4ReportBodyProps {
  site: ReportSite
  report: Ga4Report
}

export function Ga4ReportBody({ site, report }: Ga4ReportBodyProps) {
  const { totals, previousTotals: before } = report
  const tiles = [
    {
      label: 'Organic search visits',
      value: formatCount(totals.organicSearchVisits),
      change: changeOf(totals.organicSearchVisits, before.organicSearchVisits),
    },
    {
      label: 'New users',
      value: formatCount(totals.newUsers),
      change: changeOf(totals.newUsers, before.newUsers),
    },
    {
      label: 'Page views',
      value: formatCount(totals.pageViews),
      change: changeOf(totals.pageViews, before.pageViews),
    },
    {
      label: 'Avg. time on site',
      value: formatDuration(totals.avgSessionSeconds),
      change: changeOf(totals.avgSessionSeconds, before.avgSessionSeconds),
    },
    {
      label: 'Total users',
      value: formatCount(totals.totalUsers),
      change: changeOf(totals.totalUsers, before.totalUsers),
    },
    {
      label: 'Sessions',
      value: formatCount(totals.sessions),
      change: changeOf(totals.sessions, before.sessions),
    },
    {
      label: 'Engagement rate',
      value: formatPercent(totals.engagementRate),
      change: changeOf(totals.engagementRate, before.engagementRate),
    },
    ...(totals.callsAndEmails === null
      ? []
      : [
          {
            label: 'Calls & emails',
            value: formatCount(totals.callsAndEmails),
            change: changeOf(totals.callsAndEmails, before.callsAndEmails ?? 0),
          },
        ]),
  ]

  return (
    <Stack gap="xl">
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <PeriodChart
          metric="Sessions"
          days={report.sessionsByDay.map((one) => ({
            day: one.day,
            current: one.sessions,
            previous: one.previousSessions,
          }))}
          total={totals.sessions}
          previousTotal={before.sessions}
        />
        <ChannelsChart channels={report.channels} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <ReportTable
          caption="Top landing pages"
          rows={report.landingPages}
          rowKey={(row) => row.label}
          empty="No pages were visited in this range."
          columns={ROW_COLUMNS('Page')}
        />
        <ReportTable
          caption="Top sources"
          rows={report.sources}
          rowKey={(row) => row.label}
          empty="No visits in this range."
          columns={ROW_COLUMNS('Source / medium')}
        />
      </SimpleGrid>

      {site.seo ? <SeoSection seo={report.seo} /> : null}

      <Text size="sm">
        Days are counted in {report.timeZone.replace('_', ' ') || 'the property’s time zone'}, as
        set on the Google Analytics property.
      </Text>
    </Stack>
  )
}
