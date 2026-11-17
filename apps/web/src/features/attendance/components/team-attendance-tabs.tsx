'use client'

import { Badge, Tabs } from '@mantine/core'
import { ScrollingTabsList } from '@/components/scrolling-tabs-list'
import {
  IconCalendarMonth,
  IconCalendarTime,
  IconClockHour4,
  IconChartBar,
  IconFileSpreadsheet,
  IconReceipt,
  IconReportAnalytics,
} from '@tabler/icons-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { ATTENDANCE_TAB_LABELS } from '@/lib/page-tabs'
import { ATTENDANCE_TABS, type AttendanceTab } from '@/lib/routes'
import { useCorrectionQueue } from '../hooks/use-corrections'
import { useAttendanceSettings } from '../hooks/use-time-clock'
import { AttendanceBoardPanel } from './attendance-board-panel'
import { DailyTaskKpiPanel } from './daily-task-kpi-panel'
import { EmployeeSummariesPanel } from './employee-summaries-panel'
import { MonthlyReportPanel } from './monthly-report-panel'
import { ShiftsPanel } from './shifts-panel'
import { TeamCalendarPanel } from './team-calendar-panel'
import { TeamTimesheetPanel } from './team-timesheet-panel'

const TABS: { value: AttendanceTab; label: string; icon: ReactNode }[] = [
  {
    value: 'today',
    label: ATTENDANCE_TAB_LABELS.today,
    icon: <IconClockHour4 size={16} aria-hidden />,
  },
  {
    value: 'timesheets',
    label: ATTENDANCE_TAB_LABELS.timesheets,
    icon: <IconFileSpreadsheet size={16} aria-hidden />,
  },
  {
    value: 'calendar',
    label: ATTENDANCE_TAB_LABELS.calendar,
    icon: <IconCalendarMonth size={16} aria-hidden />,
  },
  {
    value: 'shifts',
    label: ATTENDANCE_TAB_LABELS.shifts,
    icon: <IconCalendarTime size={16} aria-hidden />,
  },
  {
    value: 'kpis',
    label: ATTENDANCE_TAB_LABELS.kpis,
    icon: <IconChartBar size={16} aria-hidden />,
  },
  {
    value: 'summaries',
    label: ATTENDANCE_TAB_LABELS.summaries,
    icon: <IconReportAnalytics size={16} aria-hidden />,
  },
  {
    value: 'monthly',
    label: ATTENDANCE_TAB_LABELS.monthly,
    icon: <IconReceipt size={16} aria-hidden />,
  },
]

// Pay-level reports are a superadmin's; anyone else asking for them by URL lands on Today.
const REPORT_TABS: readonly AttendanceTab[] = ['summaries', 'monthly']

function tabOf(value: string | null, canReadReports: boolean): AttendanceTab {
  const tab = (ATTENDANCE_TABS as readonly string[]).includes(value ?? '')
    ? (value as AttendanceTab)
    : 'today'
  return !canReadReports && REPORT_TABS.includes(tab) ? 'today' : tab
}

export interface TeamAttendanceTabsProps {
  canReadReports: boolean
}

/** The admin half: who is in now, the hours to sign off, and the shifts they are judged by. */
export function TeamAttendanceTabs({ canReadReports }: TeamAttendanceTabsProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const settings = useAttendanceSettings()
  // The waiting count rides on the Timesheets tab, so a request is seen from any tab.
  const waiting = useCorrectionQueue().data?.length ?? 0
  const tab = tabOf(searchParams.get('tab'), canReadReports)
  const tabs = canReadReports ? TABS : TABS.filter((entry) => !REPORT_TABS.includes(entry.value))
  const timeZone = settings.data?.settings.timeZone ?? 'UTC'

  function openTab(next: string | null) {
    const value = tabOf(next, canReadReports)
    // Only the tab survives the switch: each panel keeps its own range in the query string.
    router.replace(value === 'today' ? pathname : `${pathname}?tab=${value}`, { scroll: false })
  }

  return (
    <Tabs value={tab} onChange={openTab} keepMounted={false}>
      <ScrollingTabsList mb="lg">
        {tabs.map((entry) => (
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
      </ScrollingTabsList>

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
      <Tabs.Panel value="kpis">
        <DailyTaskKpiPanel />
      </Tabs.Panel>
      {canReadReports && (
        <>
          <Tabs.Panel value="summaries">
            <EmployeeSummariesPanel />
          </Tabs.Panel>
          <Tabs.Panel value="monthly">
            <MonthlyReportPanel />
          </Tabs.Panel>
        </>
      )}
    </Tabs>
  )
}
