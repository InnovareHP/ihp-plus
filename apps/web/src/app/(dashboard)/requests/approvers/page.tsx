import type { Metadata } from 'next'
import { PageHeader, PageShell } from '@/components/page-shell'
import { ApproversPanel } from '@/features/requests/components/approvers-panel'
import { requireFormAdmin } from '@/features/requests/guards'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Approvers' }

export default async function ApproversPage() {
  await requireFormAdmin()

  return (
    <PageShell>
      <PageHeader
        title="Approvers"
        description="Who decides each department's requests. Admins see every queue regardless."
        breadcrumbs={breadcrumbsFor(routes.requestApprovers)}
      />
      <ApproversPanel />
    </PageShell>
  )
}
