'use client'

import { Button } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { track } from '@/lib/analytics'
import { attendanceEvents } from '../events'
import type { AttendanceDayRow } from '../schema'
import { downloadCsv, timesheetCsv } from '../utils/csv'

export interface ExportTimesheetButtonProps {
  days: readonly AttendanceDayRow[] | undefined
  from: string
  to: string
  timeZone: string
}

/** Payroll wants the range as a file, not a screenshot of a table. */
export function ExportTimesheetButton({ days, from, to, timeZone }: ExportTimesheetButtonProps) {
  const rows = days ?? []

  function download() {
    downloadCsv(`timesheet-${from}-to-${to}.csv`, timesheetCsv(rows, timeZone))
    track(attendanceEvents.exported, { days: rows.length })
  }

  return (
    <Button
      variant="default"
      leftSection={<IconDownload size={18} />}
      onClick={download}
      disabled={rows.length === 0}
    >
      Export CSV
    </Button>
  )
}
