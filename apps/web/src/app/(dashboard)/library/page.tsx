import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { LibraryBrowser } from '@/features/library/components/library-browser'
import { requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Internal library' }

export default async function LibraryPage() {
  await requireOnboarded()

  return (
    <PageShell>
      <PageHeader
        title="Internal library"
        description="Every document the company keeps in SharePoint, browsable here without leaving the portal."
      />
      {/* The browser keeps the open folder and its sort in the URL, which needs a boundary. */}
      <Suspense fallback={<LibraryFallback />}>
        <LibraryBrowser />
      </Suspense>
    </PageShell>
  )
}

function LibraryFallback() {
  return (
    <Stack gap="md" aria-busy="true">
      <Skeleton height={20} width="16rem" />
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} height={56} />
      ))}
    </Stack>
  )
}
