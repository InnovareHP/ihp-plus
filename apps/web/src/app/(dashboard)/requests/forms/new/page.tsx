import type { Metadata } from 'next'
import { PageHeader, PageShell } from '@/components/page-shell'
import { FormBuilder } from '@/features/requests/components/form-builder'
import { requireFormAdmin } from '@/features/requests/guards'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'New request form' }

export default async function NewRequestFormPage() {
  await requireFormAdmin()

  return (
    <PageShell>
      <PageHeader
        title="New request form"
        description="Nothing is offered to anyone until you publish it."
        breadcrumbs={[{ label: 'Request forms', href: routes.requestForms }, { label: 'New form' }]}
      />
      <FormBuilder />
    </PageShell>
  )
}
