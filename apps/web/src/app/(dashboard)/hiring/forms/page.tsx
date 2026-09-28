import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { FormsTable } from '@/features/requests/components/forms-table'
import { requireHiringPage } from '@/features/hiring/access'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Application forms' }

export default async function ApplicationFormsPage() {
  await requireHiringPage()

  return (
    <PageShell>
      <PageHeader
        title="Application forms"
        description="The questions a job posting asks beyond name, email, phone and resume. One form can serve many postings."
        breadcrumbs={breadcrumbsFor(routes.hiringForms)}
      />
      <FormsTable kind="application" />
    </PageShell>
  )
}
