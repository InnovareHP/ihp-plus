import { SimpleGrid, Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EmptyState } from '@/components/empty-state'
import { LinkButton } from '@/components/link-button'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { PageShell } from '@/components/page-shell'
import { StatCard } from '@/components/stat-card'
import { requireHiringPage } from '@/features/hiring/access'
import { ReportFilters } from '@/features/hiring/components/report-filters'
import { ReportFunnel } from '@/features/hiring/components/report-funnel'
import { ReportPostingsTable } from '@/features/hiring/components/report-postings-table'
import { loadHiringReport } from '@/features/hiring/report-service'
import { REPORT_PERIOD_LABELS, reportQuerySchema } from '@/features/hiring/schema'
import { formatDays, formatShare } from '@/features/hiring/utils/report'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Hiring reports' }

export default async function HiringReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireHiringPage()
  const query = reportQuerySchema.parse(await searchParams)
  const report = await loadHiringReport(query)
  const { totals } = report
  const answered = report.offersAccepted + report.offersDeclined
  const period = REPORT_PERIOD_LABELS[query.period].toLowerCase()

  return (
    <PageShell>
      <PageHeader
        title="Hiring reports"
        description="How applicants who applied in the period moved through your stages, and how many became hires."
        breadcrumbs={breadcrumbsFor(routes.hiringReports)}
      />
      {/* The filters read the URL, which needs a boundary. */}
      <Suspense fallback={<Skeleton height={60} width="32rem" maw="100%" />}>
        <ReportFilters postingOptions={report.postingOptions} />
      </Suspense>

      {totals.applications === 0 ? (
        <PageSection title="No applicants in this period">
          <EmptyState
            title="Nothing to report yet"
            description="Once people apply to an open posting, this page shows how quickly they move to a hire."
            action={<LinkButton href={routes.hiring}>Go to job postings</LinkButton>}
          />
        </PageSection>
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
            <StatCard label="Applicants" value={totals.applications} hint={`Applied ${period}`} />
            <StatCard
              label="Hired"
              value={totals.hired}
              hint={`${formatShare(totals.hired, totals.applications)} of applicants`}
            />
            <StatCard
              label="Median time to hire"
              value={formatDays(totals.medianDaysToHire)}
              hint="From applying to being hired"
            />
            <StatCard
              label="Offer acceptance"
              value={answered > 0 ? formatShare(report.offersAccepted, answered) : 'No answers yet'}
              hint={`${report.offersAccepted} accepted, ${report.offersDeclined} declined`}
            />
          </SimpleGrid>

          <PageSection
            title="Stage funnel"
            description="How far each applicant got. Postings that share a stage name count together."
          >
            <ReportFunnel steps={report.funnel} applications={totals.applications} />
          </PageSection>

          <PageSection
            title="By posting"
            description={`${totals.active} still in progress, ${totals.rejected} rejected, ${totals.withdrawn} withdrew.`}
          >
            <ReportPostingsTable rows={report.postings} />
          </PageSection>
        </Stack>
      )}
    </PageShell>
  )
}
