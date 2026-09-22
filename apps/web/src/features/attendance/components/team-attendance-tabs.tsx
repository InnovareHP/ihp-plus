'use client'

import { Card, Stack, Tabs, Title } from '@mantine/core'
import { IconCalendarTime, IconClockHour4, IconFileSpreadsheet } from '@tabler/icons-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { ATTENDANCE_TABS, type AttendanceTab } from '@/lib/routes'
import { useAttendanceSettings } from '../hooks/use-time-clock'
import { AttendanceBoardPanel } from './attendance-board-panel'
import { AttendanceSettingsForm } from './attendance-settings-form'
import { ShiftsPanel } from './shifts-panel'
import { TeamTimesheetPanel } from './team-timesheet-panel'

const TABS: { value: AttendanceTab; label: string; icon: ReactNode }[] = [
  { value: 'today', label: 'Today', icon: <IconClockHour4 size={16} aria-hidden /> },
  {
    value: 'timesheets',
    label: 'Timesheets',
    icon: <IconFileSpreadsheet size={16} aria-hidden />,
  },
  { value: 'shifts', label: 'Shifts', icon: <IconCalendarTime size={16} aria-hidden /> },
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
          <Tabs.Tab key={entry.value} value={entry.value} leftSection={entry.icon}>
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
      <Tabs.Panel value="shifts">
        <Stack gap="md">
          <ShiftsPanel />
          <Card padding="lg" component="section" aria-labelledby="clock-rules-heading">
            <Title order={2} size="h5" mb="sm" id="clock-rules-heading">
              Company hours and clock rules
            </Title>
            <AttendanceSettingsForm />
          </Card>
        </Stack>
      </Tabs.Panel>
    </Tabs>
  )
}
