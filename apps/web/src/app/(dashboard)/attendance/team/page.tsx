import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { TeamAttendanceTabs } from '@/features/attendance/components/team-attendance-tabs'
import { requireOrganizationManager } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Team attendance' }

export default async function TeamAttendancePage() {
  await requireOrganizationManager()

  return (
    <PageShell>
      <PageHeader
        title="Team attendance"
        description="Who is in today, the hours behind them, and the shifts those hours are judged against."
      />
      {/* The open tab and the date range live in the query string, which needs a boundary. */}
      <Suspense
        fallback={
          <Stack gap="md" aria-busy="true">
            <Skeleton height={40} />
            <Skeleton height={320} />
          </Stack>
        }
      >
        <TeamAttendanceTabs />
      </Suspense>
    </PageShell>
  )
}
