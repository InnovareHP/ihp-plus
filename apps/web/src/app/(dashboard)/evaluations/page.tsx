import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { EvaluationsPanel } from '@/features/evaluations/components/evaluations-panel'
import { evaluationsAccess } from '@/features/evaluations/guards'

export const metadata: Metadata = { title: 'Evaluations' }

export default async function EvaluationsPage() {
  await evaluationsAccess()

  return (
    <PageShell>
      <PageHeader
        title="Evaluations"
        description="The people you have been asked to evaluate, and what you have already submitted."
      />
      {/* The status tab lives in the URL, which needs a boundary. */}
      <Suspense
        fallback={
          <Stack gap="md" aria-busy="true">
            <Skeleton height={38} />
            <Skeleton height={220} />
          </Stack>
        }
      >
        <EvaluationsPanel />
      </Suspense>
    </PageShell>
  )
}
