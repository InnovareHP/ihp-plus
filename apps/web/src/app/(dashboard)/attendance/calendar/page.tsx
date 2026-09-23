import { Skeleton } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { CalendarPanel } from '@/features/attendance/components/calendar-panel'

export const metadata: Metadata = { title: 'Calendar' }

export default function AttendanceCalendarPage() {
  return (
    <PageShell>
      <PageHeader
        title="Calendar"
        description="Company holidays, approved leave and the days you worked, a month at a time."
      />
      {/* The month lives in the URL, which needs a boundary. */}
      <Suspense fallback={<Skeleton height={680} radius="md" aria-busy="true" />}>
        <CalendarPanel />
      </Suspense>
    </PageShell>
  )
}
