import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { HiringSettingsForm } from '@/features/hiring/components/hiring-settings-form'
import { requireHiringPage } from '@/features/hiring/access'
import { loadSettings } from '@/features/hiring/service'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Hiring settings' }

export default async function HiringSettingsPage() {
  await requireHiringPage()
  const settings = await loadSettings()

  return (
    <PageShell>
      <PageHeader
        title="Hiring settings"
        description="Who runs hiring, the stages a new posting starts with, and what a rejected applicant is told."
        breadcrumbs={breadcrumbsFor(routes.hiringSettings)}
      />
      <HiringSettingsForm settings={settings} />
    </PageShell>
  )
}
