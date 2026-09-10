import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader, PageShell } from '@/components/page-shell'
import { RequestDetail } from '@/features/requests/components/request-detail'
import { requestsAccess } from '@/features/requests/guards'
import { loadRequest } from '@/features/requests/service'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Request' }

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requestsAccess()

  // The service throws a Connect permission error for a request that is not the caller's to
  // read; on a page that is a 404, not a code.
  const request = await loadRequest(id).catch(() => null)
  if (!request) notFound()

  return (
    <PageShell>
      <PageHeader
        title={request.formName}
        description={request.isMine ? 'Your request.' : `Raised by ${request.requesterName}.`}
        breadcrumbs={[{ label: 'Requests', href: routes.requests }, { label: request.formName }]}
      />
      <RequestDetail initial={request} />
    </PageShell>
  )
}
