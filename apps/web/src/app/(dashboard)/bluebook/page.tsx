import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader, PageShell } from '@/components/page-shell'
import { BluebookLibrary } from '@/features/bluebook/components/bluebook-library'
import { requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Bluebook' }

export default async function BluebookPage() {
  await requireOnboarded()

  return (
    <PageShell>
      <PageHeader
        title="Bluebook"
        description="The company handbook: policies, forms and training for every department, plus the shelf that applies to all of them."
      />
      {/* The library keeps its shelf, search and filters in the URL, which needs a boundary. */}
      <Suspense fallback={<BluebookFallback />}>
        <BluebookLibrary />
      </Suspense>
    </PageShell>
  )
}

function BluebookFallback() {
  return (
    <Stack gap="md" aria-busy="true">
      <Skeleton height={60} width="18rem" />
      <Skeleton height={32} />
      <Skeleton height={38} />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} height={56} />
      ))}
    </Stack>
  )
}
