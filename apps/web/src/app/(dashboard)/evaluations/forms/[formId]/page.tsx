import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { FormBuilder } from '@/features/requests/components/form-builder'
import { requireEvaluationAdmin } from '@/features/evaluations/guards'
import { loadForm } from '@/features/requests/service'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Edit evaluation form' }

export default async function EditEvaluationFormPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params
  await requireEvaluationAdmin()

  const form = await loadForm(formId).catch(() => null)
  if (!form || form.kind !== 'evaluation') notFound()

  return (
    <PageShell>
      <PageHeader
        title={form.name}
        description={
          form.submissionCount > 0
            ? `${form.submissionCount} ${form.submissionCount === 1 ? 'evaluation has' : 'evaluations have'} been assigned on this form. The ones already assigned keep the questions they were assigned with.`
            : 'No evaluations have been assigned on this form yet.'
        }
        breadcrumbs={[
          { label: 'Evaluation forms', href: routes.evaluationForms },
          { label: form.name },
        ]}
      />
      <FormBuilder form={form} />
    </PageShell>
  )
}
