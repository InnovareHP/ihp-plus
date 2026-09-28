import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { FormBuilder } from '@/features/requests/components/form-builder'
import { requireHiringPage } from '@/features/hiring/access'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'New application form' }

export default async function NewApplicationFormPage() {
  await requireHiringPage()

  return (
    <PageShell>
      <PageHeader
        title="New application form"
        description="Name it, add the questions, then publish it to pick it on a job posting."
        breadcrumbs={[
          { label: 'Application forms', href: routes.hiringForms },
          { label: 'New form' },
        ]}
      />
      <FormBuilder kind="application" />
    </PageShell>
  )
}
