import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader, PageShell } from '@/components/page-shell'
import { OrganizationTabs } from '@/features/organization/components/organization-tabs'
import { requireOrganizationManager } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Organization' }

export default async function OrganizationPage() {
  const { user, profile } = await requireOrganizationManager()

  return (
    <PageShell>
      <PageHeader
        title="Organization"
        description="Your company as the portal sees it — who belongs to it, how it is divided, who leads and approves, and who is still waiting to join."
      />
      {/* The open tab lives in the query string, which needs a boundary. */}
      <Suspense
        fallback={
          <Stack gap="md" aria-busy="true">
            <Skeleton height={40} />
            <Skeleton height={220} />
          </Stack>
        }
      >
        <OrganizationTabs invitedBy={profile.preferredName ?? user.name} />
      </Suspense>
    </PageShell>
  )
}
