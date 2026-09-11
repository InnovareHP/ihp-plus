import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { FormsTable } from '@/features/requests/components/forms-table'
import { requireFormAdmin } from '@/features/requests/guards'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Request forms' }

export default async function RequestFormsPage() {
  await requireFormAdmin()

  return (
    <PageShell>
      <PageHeader
        title="Request forms"
        description="Build the forms your company runs on and choose which departments each one is offered to."
        breadcrumbs={breadcrumbsFor(routes.requestForms)}
      />
      <FormsTable />
    </PageShell>
  )
}
