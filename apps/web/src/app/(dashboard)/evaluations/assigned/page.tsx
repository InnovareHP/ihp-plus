import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { EvaluationTracker } from '@/features/evaluations/components/evaluation-tracker'
import { requireEvaluationAdmin } from '@/features/evaluations/guards'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Assigned evaluations' }

export default async function AssignedEvaluationsPage() {
  await requireEvaluationAdmin()

  return (
    <PageShell>
      <PageHeader
        title="Assigned evaluations"
        description="Who is being evaluated, by whom, and who has not answered yet."
        breadcrumbs={breadcrumbsFor(routes.evaluationTracker)}
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
        <EvaluationTracker />
      </Suspense>
    </PageShell>
  )
}
