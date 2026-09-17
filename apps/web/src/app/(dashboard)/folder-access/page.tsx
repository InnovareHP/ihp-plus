import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { OrganizationAccessTable } from '@/features/drive/components/organization-access-table'
import { requireOrganizationManager } from '@/lib/auth-guard'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Folder access' }

export default async function FolderAccessPage() {
  // Sharing is any member's job; seeing every grant at once is an admin's.
  await requireOrganizationManager()

  return (
    <PageShell>
      <PageHeader
        title="Folder access"
        description="Everyone outside the company who can open a client folder in SharePoint, and what they can open."
        breadcrumbs={breadcrumbsFor(routes.folderAccess)}
      />
      {/* The table keeps its page, sort and filters in the URL, which needs a boundary. */}
      <Suspense fallback={<AccessFallback />}>
        <OrganizationAccessTable />
      </Suspense>
    </PageShell>
  )
}

function AccessFallback() {
  return (
    <Stack gap="md" aria-busy="true">
      <Skeleton height={38} width="18rem" />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} height={56} />
      ))}
    </Stack>
  )
}
