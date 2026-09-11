import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { RequestsPanel } from '@/features/requests/components/requests-panel'
import { requestsAccess } from '@/features/requests/guards'

export const metadata: Metadata = { title: 'Requests' }

export default async function RequestsPage() {
  const access = await requestsAccess()

  return (
    <PageShell>
      <PageHeader
        title="Requests"
        description="Raise a company request on one of the forms your department is offered, and follow it through."
      />
      {/* The status tab lives in the URL, which needs a boundary. */}
      <Suspense
        fallback={
          <Stack gap="md" aria-busy="true">
            <Skeleton height={132} />
            <Skeleton height={220} />
          </Stack>
        }
      >
        <RequestsPanel hasDepartment={Boolean(access.membership.team)} />
      </Suspense>
    </PageShell>
  )
}
