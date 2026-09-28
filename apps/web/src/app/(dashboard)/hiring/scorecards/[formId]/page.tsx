import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { FormBuilder } from '@/features/requests/components/form-builder'
import { requireHiringPage } from '@/features/hiring/access'
import { loadForm } from '@/features/requests/service'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Edit scorecard' }

export default async function EditScorecardPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params
  await requireHiringPage()

  const form = await loadForm(formId).catch(() => null)
  if (!form || form.kind !== 'scorecard') notFound()

  return (
    <PageShell>
      <PageHeader
        title={form.name}
        description={
          form.submissionCount > 0
            ? `${form.submissionCount} ${form.submissionCount === 1 ? 'posting asks' : 'postings ask'} this scorecard. Scorecards already filled in keep the questions as they were answered.`
            : 'No job posting uses this scorecard yet.'
        }
        breadcrumbs={[{ label: 'Scorecards', href: routes.hiringScorecards }, { label: form.name }]}
      />
      <FormBuilder form={form} />
    </PageShell>
  )
}
