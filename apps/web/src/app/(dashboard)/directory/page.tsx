import { SimpleGrid, Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader, PageShell } from '@/components/page-shell'
import { DirectoryGrid } from '@/features/directory/components/directory-grid'
import { requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Directory' }

export default async function DirectoryPage() {
  await requireOnboarded()

  return (
    <PageShell>
      <PageHeader
        title="Directory"
        description="Everyone at the company: who they are, what they do, which department they are in, and how to reach them."
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
      <Skeleton height={60} width="18rem" />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((card) => (
          <Skeleton key={card} height={196} radius="md" />
        ))}
      </SimpleGrid>
    </Stack>
  )
}
