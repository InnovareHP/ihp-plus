'use client'

import { Badge, Tabs } from '@mantine/core'
import {
  IconCalendarMonth,
  IconCalendarTime,
  IconClockHour4,
  IconFileInvoice,
  IconFileSpreadsheet,
} from '@tabler/icons-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { ATTENDANCE_TABS, type AttendanceTab } from '@/lib/routes'
import { useCorrectionQueue } from '../hooks/use-corrections'
import { useAttendanceSettings } from '../hooks/use-time-clock'
import { AttendanceBoardPanel } from './attendance-board-panel'
import { BillingStatementsPanel } from './billing-statements-panel'
import { ShiftsPanel } from './shifts-panel'
import { TeamCalendarPanel } from './team-calendar-panel'
import { TeamTimesheetPanel } from './team-timesheet-panel'

const TABS: { value: AttendanceTab; label: string; icon: ReactNode }[] = [
  { value: 'today', label: 'Today', icon: <IconClockHour4 size={16} aria-hidden /> },
  {
    value: 'timesheets',
    label: 'Timesheets',
    icon: <IconFileSpreadsheet size={16} aria-hidden />,
  },
  { value: 'calendar', label: 'Calendar', icon: <IconCalendarMonth size={16} aria-hidden /> },
  { value: 'shifts', label: 'Shifts', icon: <IconCalendarTime size={16} aria-hidden /> },
  {
    value: 'statements',
    label: 'Statements',
    icon: <IconFileInvoice size={16} aria-hidden />,
  },
]

function tabOf(value: string | null): AttendanceTab {
  return (ATTENDANCE_TABS as readonly string[]).includes(value ?? '')
    ? (value as AttendanceTab)
    : 'today'
}

/** The admin half: who is in now, the hours to sign off, and the shifts they are judged by. */
export function TeamAttendanceTabs() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const settings = useAttendanceSettings()
  // The waiting count rides on the Timesheets tab, so a request is seen from any tab.
  const waiting = useCorrectionQueue().data?.length ?? 0
  const tab = tabOf(searchParams.get('tab'))
  const timeZone = settings.data?.settings.timeZone ?? 'UTC'

  function openTab(next: string | null) {
    const value = tabOf(next)
    // Only the tab survives the switch: each panel keeps its own range in the query string.
    router.replace(value === 'today' ? pathname : `${pathname}?tab=${value}`, { scroll: false })
  }

  return (
    <Tabs value={tab} onChange={openTab} keepMounted={false}>
      <Tabs.List mb="lg">
        {TABS.map((entry) => (
          <Tabs.Tab
            key={entry.value}
            value={entry.value}
            leftSection={entry.icon}
            rightSection={
              entry.value === 'timesheets' && waiting > 0 ? (
                <Badge
                  size="sm"
                  color="yellow"
                  variant="light"
                  aria-label={`${waiting} correction requests waiting`}
                >
                  {waiting}
                </Badge>
              ) : undefined
            }
          >
            {entry.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {/* keepMounted={false}: an unopened tab must not run its queries. */}
      <Tabs.Panel value="today">
        <AttendanceBoardPanel timeZone={timeZone} />
      </Tabs.Panel>
      <Tabs.Panel value="timesheets">
        <TeamTimesheetPanel timeZone={timeZone} />
      </Tabs.Panel>
      <Tabs.Panel value="calendar">
        <TeamCalendarPanel />
      </Tabs.Panel>
      <Tabs.Panel value="shifts">
        <ShiftsPanel />
      </Tabs.Panel>
      <Tabs.Panel value="statements">
        <BillingStatementsPanel everyone />
      </Tabs.Panel>
    </Tabs>
  )
}
