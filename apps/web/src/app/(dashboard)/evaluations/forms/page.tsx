import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { FormsTable } from '@/features/requests/components/forms-table'
import { requireEvaluationAdmin } from '@/features/evaluations/guards'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Evaluation forms' }

export default async function EvaluationFormsPage() {
  await requireEvaluationAdmin()

  return (
    <PageShell>
      <PageHeader
        title="Evaluation forms"
        description="Build what a supervisor is asked about someone. An evaluation reaches people by assignment, so it needs no department."
        breadcrumbs={breadcrumbsFor(routes.evaluationForms)}
      />
      <FormsTable kind="evaluation" />
    </PageShell>
  )
}
