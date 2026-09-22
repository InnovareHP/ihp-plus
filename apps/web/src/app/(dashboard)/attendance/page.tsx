import { Skeleton } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { MyAttendancePanel } from '@/features/attendance/components/my-attendance-panel'
import { TimeClockCard } from '@/features/attendance/components/time-clock-card'

export const metadata: Metadata = { title: 'Time clock' }

export default function AttendancePage() {
  return (
    <PageShell>
      <PageHeader
        title="Time clock"
        description="Clock in when you start, take your breaks, clock out when you are done — your hours are counted as you go."
      />
      <TimeClockCard />
      {/* The date range lives in the URL, which needs a boundary. */}
      <Suspense fallback={<Skeleton height={320} radius="md" aria-busy="true" />}>
        <MyAttendancePanel />
      </Suspense>
    </PageShell>
  )
}
