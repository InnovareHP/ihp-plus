import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { PostingsTable } from '@/features/hiring/components/postings-table'
import { requireHiringPage } from '@/features/hiring/access'

export const metadata: Metadata = { title: 'Job postings' }

export default async function JobPostingsPage() {
  await requireHiringPage()

  return (
    <PageShell>
      <PageHeader
        title="Job postings"
        description="Write a posting, publish it to the careers page, and follow each applicant through its stages."
      />
      {/* The status filter, search and page all live in the URL, which needs a boundary. */}
      <Suspense
        fallback={
          <Stack gap="xs" aria-busy="true">
            <Skeleton height={38} width="20rem" />
            <Skeleton height={38} />
            <Skeleton height={56} />
          </Stack>
        }
      >
        <PostingsTable />
      </Suspense>
    </PageShell>
  )
}
