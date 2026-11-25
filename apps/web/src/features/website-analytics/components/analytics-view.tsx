'use client'

import { Box, Stack, Text } from '@mantine/core'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PageSection } from '@/components/page-section'
import { daysIn, type DayRange } from '../days'
import { rangeLabel, reportQueryOf, reportViewOf, type RangePreset } from '../report-range'
import type { ReportSite } from '../sites'
import { useGa4Report } from '../use-ga4-report'
import { AnalyticsControls } from './analytics-controls'
import { Ga4ReportBody } from './ga4-report-body'
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
        <ReportBody site={view.site} ga4={ga4} />
      </PageSection>
    </Stack>
  )
}

function ReportBody({ site, ga4 }: { site: ReportSite; ga4: ReturnType<typeof useGa4Report> }) {
  if (site.source === 'netlify') {
    return <Text size="sm">Netlify numbers arrive in the next step.</Text>
  }
  if (ga4.isPending) return <ReportSkeleton />
  if (ga4.isError) {
    return (
      <ReportError
        message={ga4.error.message}
        retrying={ga4.isFetching}
        onRetry={() => ga4.refetch()}
      />
    )
  }

  const report = ga4.data
  if (report.totals.sessions === 0 && report.previousTotals.sessions === 0) {
    return (
      <Text size="sm">
        Google Analytics recorded no visits to {site.name} in this range or the one before it.
        Tracking may have started later, so try a more recent range.
      </Text>
    )
  }

  // The last report stays readable but dimmed while the next site or range loads.
  return (
    <Box
      aria-busy={ga4.isPlaceholderData}
      opacity={ga4.isPlaceholderData ? 0.5 : 1}
      style={{ transition: 'opacity 150ms ease-out' }}
    >
      <Ga4ReportBody site={site} report={report} />
    </Box>
  )
}
