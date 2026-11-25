'use client'

import { Box, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PageSection } from '@/components/page-section'
import { daysIn, type DayRange } from '../days'
import { rangeLabel, reportQueryOf, reportViewOf, type RangePreset } from '../report-range'
import type { ReportSite } from '../sites'
import { useGa4Report } from '../hooks/use-ga4-report'
import { useNetlifyReport } from '../hooks/use-netlify-report'
import { AnalyticsControls } from './analytics-controls'
import { Ga4ReportBody } from './ga4-report-body'
import { NetlifyReportBody } from './netlify-report-body'
import { ReportError } from './report-error'
import { ReportSkeleton } from './report-skeleton'

const SOURCE_NOTE = {
  ga4: 'From Google Analytics, counted in the property’s own time zone.',
  netlify: 'From Netlify Analytics, counted in Michigan time.',
} as const

export function AnalyticsView({ today }: { today: string }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const view = reportViewOf(
    {
      site: searchParams.get('site'),
      range: searchParams.get('range'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    },
    today,
  )

  function show(next: { siteKey?: string; preset: RangePreset; range?: DayRange }) {
    const query = reportQueryOf({ siteKey: next.siteKey ?? view.site.key, ...next })
    router.replace(`${pathname}?${query.toString()}`, { scroll: false })
  }

  const days = daysIn(view.range)
  const ga4 = useGa4Report(view.site.key, view.range, view.site.source === 'ga4')
  const netlify = useNetlifyReport(view.site.key, view.range, view.site.source === 'netlify')

  return (
    <Stack gap="lg">
      <AnalyticsControls
        siteKey={view.site.key}
        preset={view.preset}
        range={view.range}
        today={today}
        onSiteChange={(siteKey) => show({ siteKey, preset: view.preset, range: view.range })}
        onRangeChange={(preset, range) => show({ preset, range })}
      />

      <PageSection
        title={view.site.name}
        description={
          <>
            {rangeLabel(view.range)} ({days} {days === 1 ? 'day' : 'days'}), compared with{' '}
            {rangeLabel(view.previous)}. {SOURCE_NOTE[view.site.source]}
          </>
        }
      >
        {view.site.source === 'ga4' ? (
          <Ga4Body site={view.site} query={ga4} />
        ) : (
          <NetlifyBody site={view.site} query={netlify} />
        )}
      </PageSection>
    </Stack>
  )
}

// The last report stays readable but dimmed while the next site or range loads.
function Faded({ fading, children }: { fading: boolean; children: ReactNode }) {
  return (
    <Box
      aria-busy={fading}
      opacity={fading ? 0.5 : 1}
      style={{ transition: 'opacity 150ms ease-out' }}
    >
      {children}
    </Box>
  )
}

interface ReportQuery<T> {
  isPending: boolean
  isError: boolean
  isFetching: boolean
  isPlaceholderData: boolean
  error: Error | null
  data: T | undefined
  refetch: () => unknown
}

/** The loading and error screens both sources share, or null once there is a report. */
function waiting<T>(query: ReportQuery<T>): ReactNode {
  if (query.isPending) return <ReportSkeleton />
  if (query.isError || !query.data) {
    return (
      <ReportError
        message={query.error?.message ?? 'The report did not load.'}
        retrying={query.isFetching}
        onRetry={() => query.refetch()}
      />
    )
  }
  return null
}

function Ga4Body({ site, query }: { site: ReportSite; query: ReturnType<typeof useGa4Report> }) {
  const report = query.data
  if (!report || query.isError) return waiting(query)
  if (report.totals.sessions === 0 && report.previousTotals.sessions === 0) {
    return (
      <Text size="sm">
        Google Analytics recorded no visits to {site.name} in this range or the one before it.
        Tracking may have started later, so try a more recent range.
      </Text>
    )
  }
  return (
    <Faded fading={query.isPlaceholderData}>
      <Ga4ReportBody site={site} report={report} />
    </Faded>
  )
}

function NetlifyBody({
  site,
  query,
}: {
  site: ReportSite
  query: ReturnType<typeof useNetlifyReport>
}) {
  const report = query.data
  if (!report || query.isError) return waiting(query)
  if (report.coverage.savedDays === 0) {
    return (
      <Text size="sm">
        No Netlify numbers are saved for {site.name} in this range. The nightly job saves page views
        from Sep 1, 2026 on, so pick a range after that.
      </Text>
    )
  }
  return (
    <Faded fading={query.isPlaceholderData}>
      <NetlifyReportBody report={report} />
    </Faded>
  )
}
