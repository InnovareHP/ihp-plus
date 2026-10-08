import { Skeleton } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { MyAttendancePanel } from '@/features/attendance/components/my-attendance-panel'
import { TimeClockCard } from '@/features/attendance/components/time-clock-card'
import { websitesAccess } from '@/features/websites/access'
import { TimeClockChecks } from '@/features/websites/components/time-clock-checks'

export const metadata: Metadata = { title: 'Time clock' }

export default async function AttendancePage() {
  // Only the IT lead's clock starts a website round, so only they see what it found.
  const { canCheck } = await websitesAccess()

  return (
    <PageShell>
      <PageHeader
        title="Time clock"
        description="Clock in when you start, take your breaks, clock out when you are done — your hours are counted as you go."
      />
      <TimeClockCard />
      {canCheck ? <TimeClockChecks /> : null}
      {/* The date range lives in the URL, which needs a boundary. */}
      <Suspense fallback={<Skeleton height={320} radius="md" aria-busy="true" />}>
        <MyAttendancePanel />
      </Suspense>
    </PageShell>
  )
}
