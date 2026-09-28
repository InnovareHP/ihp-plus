import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { FormBuilder } from '@/features/requests/components/form-builder'
import { requireHiringPage } from '@/features/hiring/access'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'New scorecard' }

export default async function NewScorecardPage() {
  await requireHiringPage()

  return (
    <PageShell>
      <PageHeader
        title="New scorecard"
        description="Name it, add the questions, then publish it to pick it on a job posting. An overall recommendation is always asked as well."
        breadcrumbs={[
          { label: 'Scorecards', href: routes.hiringScorecards },
          { label: 'New form' },
        ]}
      />
      <FormBuilder kind="scorecard" />
    </PageShell>
  )
}
