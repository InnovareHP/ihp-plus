import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { RequestForm } from '@/features/requests/components/request-form'
import { requestsAccess } from '@/features/requests/guards'
import { loadAvailableForms } from '@/features/requests/service'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'New request' }

// Read once and never refetched, so the server component calls the service directly.
export default async function NewRequestPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params
  await requestsAccess()

  const form = (await loadAvailableForms()).find((candidate) => candidate.id === formId)
  // Not a redirect: a form that is not open to this department should not announce itself.
  if (!form) notFound()

  return (
    <PageShell>
      <PageHeader
        title={form.name}
        description={form.description || 'Fill this in and it goes to your department approvers.'}
        breadcrumbs={[{ label: 'Requests', href: routes.requests }, { label: form.name }]}
      />
      <RequestForm form={form} />
    </PageShell>
  )
}
