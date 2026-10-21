import { Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LinkButton } from '@/components/link-button'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { DirectoryGrid } from '@/features/directory/components/directory-grid'
import { DirectorySkeleton } from '@/features/directory/components/directory-skeleton'
import { DirectoryToolbarSkeleton } from '@/features/directory/components/directory-toolbar-skeleton'
import { requireOnboarded } from '@/lib/auth-guard'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Directory' }

export default async function DirectoryPage() {
  await requireOnboarded()

  return (
    <PageShell>
      <PageHeader
        title="Directory"
        description="Everyone at the company: who they are, what they do, which department they are in, and how to reach them."
        actions={
          <LinkButton href={routes.directoryChart} variant="subtle" mih={{ base: 44, sm: 0 }}>
            View the org chart
          </LinkButton>
        }
      />
      {/* The grid keeps its search and department filter in the URL, which needs a boundary. */}
      <Suspense fallback={<DirectoryFallback />}>
        <DirectoryGrid />
      </Suspense>
    </PageShell>
  )
}

function DirectoryFallback() {
  return (
    <Stack gap="md" aria-busy="true">
      <DirectoryToolbarSkeleton />
      <DirectorySkeleton />
    </Stack>
  )
}
