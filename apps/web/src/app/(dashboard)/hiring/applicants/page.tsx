import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { ApplicantsPanel } from '@/features/hiring/components/applicants-panel'
import { requireHiringPage } from '@/features/hiring/access'
import { loadSettings } from '@/features/hiring/service'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Applicants' }

export default async function ApplicantsPage() {
  await requireHiringPage()
  const settings = await loadSettings()

  return (
    <PageShell>
      <PageHeader
        title="Applicants"
        description="Everyone who applied, across every posting. Open a posting to work its stages as a board."
        breadcrumbs={breadcrumbsFor(routes.hiringApplicants)}
      />
      {/* The filters and page live in the URL, which needs a boundary. */}
      <Suspense
        fallback={
          <Stack gap="xs" aria-busy="true">
            <Skeleton height={38} width="20rem" />
            <Skeleton height={38} />
            <Skeleton height={56} />
          </Stack>
        }
      >
        <ApplicantsPanel rejectionMessage={settings.rejectionMessage} />
      </Suspense>
    </PageShell>
  )
}
