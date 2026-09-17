import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { FormBuilder } from '@/features/requests/components/form-builder'
import { requireFormAdmin } from '@/features/requests/guards'
import { loadForm } from '@/features/requests/service'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Edit request form' }

export default async function EditRequestFormPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params
  await requireFormAdmin()

  const form = await loadForm(formId).catch(() => null)
  // An evaluation form is edited from its own catalogue, which has no department picker.
  if (!form || form.kind !== 'request') notFound()

  return (
    <PageShell>
      <PageHeader
        title={form.name}
        description={
          form.submissionCount > 0
            ? `${form.submissionCount} ${form.submissionCount === 1 ? 'request has' : 'requests have'} been raised on this form. Requests already sent keep the questions they were answered against.`
            : 'No requests have been raised on this form yet.'
        }
        breadcrumbs={[{ label: 'Request forms', href: routes.requestForms }, { label: form.name }]}
      />
      <FormBuilder form={form} />
    </PageShell>
  )
}
