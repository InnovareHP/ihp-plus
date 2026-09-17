import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { FormBuilder } from '@/features/requests/components/form-builder'
import { requireEvaluationAdmin } from '@/features/evaluations/guards'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'New evaluation form' }

export default async function NewEvaluationFormPage() {
  await requireEvaluationAdmin()

  return (
    <PageShell>
      <PageHeader
        title="New evaluation form"
        description="Name it, add the questions, then publish it to start assigning it."
        breadcrumbs={[
          { label: 'Evaluation forms', href: routes.evaluationForms },
          { label: 'New form' },
        ]}
      />
      <FormBuilder kind="evaluation" />
    </PageShell>
  )
}
