import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { EvaluationDetail } from '@/features/evaluations/components/evaluation-detail'
import { evaluationsAccess } from '@/features/evaluations/guards'
import { loadEvaluation } from '@/features/evaluations/service'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Evaluation' }

export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await evaluationsAccess()

  const evaluation = await loadEvaluation(id).catch(() => null)
  // Not a redirect: an evaluation that is not yours should not announce itself.
  if (!evaluation) notFound()

  return (
    <PageShell>
      <PageHeader
        // The heading names no one: it is what a passer-by or a screen share sees first.
        title={evaluation.formName}
        description="What was recorded, as it was answered."
        breadcrumbs={[{ label: 'Evaluations', href: routes.evaluations }, { label: 'Evaluation' }]}
      />
      <EvaluationDetail initial={evaluation} />
    </PageShell>
  )
}
