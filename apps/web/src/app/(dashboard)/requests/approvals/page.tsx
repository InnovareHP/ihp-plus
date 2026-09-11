import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { ApprovalsPanel } from '@/features/requests/components/approvals-panel'
import { requireApprover } from '@/features/requests/guards'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Approvals' }

export default async function ApprovalsPage() {
  const access = await requireApprover()

  return (
    <PageShell>
      <PageHeader
        title="Approvals"
        description={
          access.isAdmin
            ? 'Every request raised in this organization, whichever department it came from.'
            : 'Requests raised in the departments you approve for.'
        }
        breadcrumbs={breadcrumbsFor(routes.requestApprovals)}
      />
      {/* The status tab, search and page all live in the URL, which needs a boundary. */}
      <Suspense
        fallback={
          <Stack gap="xs" aria-busy="true">
            <Skeleton height={60} width="20rem" />
            <Skeleton height={38} />
            <Skeleton height={56} />
          </Stack>
        }
      >
        <ApprovalsPanel />
      </Suspense>
    </PageShell>
  )
}
