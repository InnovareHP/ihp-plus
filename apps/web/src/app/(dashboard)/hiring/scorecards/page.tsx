import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { FormsTable } from '@/features/requests/components/forms-table'
import { requireHiringPage } from '@/features/hiring/access'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Scorecards' }

export default async function ScorecardsPage() {
  await requireHiringPage()

  return (
    <PageShell>
      <PageHeader
        title="Scorecards"
        description="What interviewers answer about each applicant after meeting them. One scorecard can serve many postings."
        breadcrumbs={breadcrumbsFor(routes.hiringScorecards)}
      />
      <FormsTable kind="scorecard" />
    </PageShell>
  )
}
