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
        title={`${evaluation.formName} · ${evaluation.employeeName}`}
        description="What the supervisor recorded, as it was answered."
        breadcrumbs={[
          { label: 'Evaluations', href: routes.evaluations },
          { label: evaluation.employeeName },
        ]}
      />
      <EvaluationDetail initial={evaluation} />
    </PageShell>
  )
}
