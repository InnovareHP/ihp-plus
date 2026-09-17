import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { TaskBoard } from '@/features/tasks/components/task-board'

export const metadata: Metadata = { title: 'Tasks' }

export default function TasksPage() {
  return (
    <PageShell>
      <PageHeader
        title="Tasks"
        description="Projects, lists and the work inside them — what your team owes itself."
      />
      {/* The project, filters and search live in the URL, which needs a boundary. */}
      <Suspense
        fallback={
          <Stack gap="md" aria-busy="true">
            <Skeleton height={72} />
            <Skeleton height={120} />
            <Skeleton height={240} />
          </Stack>
        }
      >
        <TaskBoard />
      </Suspense>
    </PageShell>
  )
}
