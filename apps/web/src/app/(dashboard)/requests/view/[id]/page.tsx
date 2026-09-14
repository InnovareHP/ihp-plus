import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ActivityTimeline } from '@/components/activity-timeline'
import { PageSection } from '@/components/page-section'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { RequestDetail } from '@/features/requests/components/request-detail'
import { requestsAccess } from '@/features/requests/guards'
import { loadRequest } from '@/features/requests/service'
import { loadActivity } from '@/lib/activity'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Request' }

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requestsAccess()

  // The service throws a Connect permission error for a request that is not the caller's to
  // read; on a page that is a 404, not a code.
  const request = await loadRequest(id).catch(() => null)
  if (!request) notFound()

  // Read only after loadRequest has confirmed this caller may see the request at all.
  const organizationId = access.membership.organizationId
  const history = organizationId ? await loadActivity(organizationId, 'request', request.id) : []

  return (
    <PageShell>
      <PageHeader
        title={request.formName}
        description={request.isMine ? 'Your request.' : `Raised by ${request.requesterName}.`}
        breadcrumbs={[{ label: 'Requests', href: routes.requests }, { label: request.formName }]}
      />
      <RequestDetail initial={request} />
      <PageSection title="History" description="Every change to this request, oldest first.">
        <ActivityTimeline items={history} label="Request history" />
      </PageSection>
    </PageShell>
  )
}
