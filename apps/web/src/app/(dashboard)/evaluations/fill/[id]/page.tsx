import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { EvaluationForm } from '@/features/evaluations/components/evaluation-form'
import { evaluationsAccess } from '@/features/evaluations/guards'
import { loadEvaluation } from '@/features/evaluations/service'
import { evaluationRoute, routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Fill in an evaluation' }

// Read once and never refetched, so the server component calls the service directly.
export default async function FillEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await evaluationsAccess()

  const evaluation = await loadEvaluation(id).catch(() => null)
  // Not a redirect: an evaluation that is not yours should not announce itself.
  if (!evaluation) notFound()
  // Already answered, so the form would only offer to overwrite a record nobody may change.
  if (!evaluation.canFill) redirect(evaluationRoute(evaluation.id))

  return (
    <PageShell>
      <PageHeader
        title={`Evaluate ${evaluation.employeeName}`}
        description={evaluation.formName}
        breadcrumbs={[
          { label: 'Evaluations', href: routes.evaluations },
          { label: evaluation.employeeName },
        ]}
      />
      <EvaluationForm evaluation={evaluation} />
    </PageShell>
  )
}
