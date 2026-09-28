import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { ApplicationDetailView } from '@/features/hiring/components/application-detail-view'
import { requireHiringPage } from '@/features/hiring/access'
import { loadApplication } from '@/features/hiring/pipeline-service'
import { loadSettings } from '@/features/hiring/service'
import { postingRoute, routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Application' }

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>
}) {
  const { applicationId } = await params
  const access = await requireHiringPage()

  const [application, settings] = await Promise.all([
    loadApplication(applicationId).catch(() => null),
    loadSettings(),
  ])
  if (!application) notFound()
  const { summary } = application

  return (
    <PageShell>
      <PageHeader
        title={summary.fullName}
        description={`Applied for ${summary.postingTitle}.`}
        breadcrumbs={[
          { label: 'Job postings', href: routes.hiring },
          { label: summary.postingTitle, href: postingRoute(summary.postingId) },
          { label: summary.fullName },
        ]}
      />
      <ApplicationDetailView
        application={application}
        rejectionMessage={settings.rejectionMessage}
        viewerName={access.name}
        organizationName={access.membership.organization?.name ?? 'IHP+'}
      />
    </PageShell>
  )
}
