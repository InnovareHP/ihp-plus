import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader, PageShell } from '@/components/page-shell'
import { TeamsPanel } from '@/features/organization/components/teams-panel'
import { requireOrganizationManager } from '@/lib/auth-guard'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Departments' }

export default async function TeamsPage() {
  await requireOrganizationManager()

  return (
    <PageShell>
      <PageHeader
        title="Departments"
        description="Every person belongs to one department, and it is what their dashboard and ID card show."
        breadcrumbs={breadcrumbsFor(routes.teams)}
      />
      {/* The panel keeps its search and open department in the URL, which needs a boundary. */}
      <Suspense fallback={<TeamsFallback />}>
        <TeamsPanel />
      </Suspense>
    </PageShell>
  )
}

function TeamsFallback() {
  return (
    <Stack gap="md" aria-busy="true">
      <Skeleton height={60} width="18rem" />
      <Skeleton height={38} />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} height={56} />
      ))}
    </Stack>
  )
}
