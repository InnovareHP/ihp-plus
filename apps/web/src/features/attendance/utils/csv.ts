import type { AttendanceAbsenceRow, AttendanceDayRow } from '../schema'
import { formatTimeOfDay } from './clock'

const HEADERS = [
  'Employee',
  'Date',
  'Clock in',
  'Clock out',
  'Worked hours',
  'Break hours',
  'Late minutes',
  'Status',
  'Source',
  'Note',
] as const

// A leading =, +, - or @ makes a spreadsheet treat the text as a formula, so it is defused.
function cell(value: string | number | undefined): string {
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function hours(seconds: number) {
  return (seconds / 3600).toFixed(2)
}

/**
 * The timesheet as payroll reads it: one row per person per day, hours in decimals, with the
 * scheduled days nobody clocked alongside so an unpaid day is not simply missing from the file.
 */
export function timesheetCsv(
  days: readonly AttendanceDayRow[],
  timeZone: string,
  absences: readonly AttendanceAbsenceRow[] = [],
): string {
  const worked = days.map((day) => ({
    name: day.userName,
    date: day.workDate,
    cells: [
      day.clockInAt ? formatTimeOfDay(day.clockInAt, timeZone) : '',
      day.clockOutAt ? formatTimeOfDay(day.clockOutAt, timeZone) : '',
      hours(day.workedSeconds),
      hours(day.breakSeconds),
      String(Math.round(day.lateSeconds / 60)),
      day.autoClosed ? 'missed clock-out' : day.status,
      day.source,
      day.note ?? '',
    ],
  }))
  const missed = absences.map((absence) => ({
    name: absence.userName,
    date: absence.workDate,
    cells: ['', '', hours(0), hours(0), '0', absence.kind, '', absence.leaveName ?? ''],
  }))

  const rows = [...worked, ...missed]
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))
    .map((row) => [row.name, row.date, ...row.cells].map(cell).join(','))

  return [HEADERS.join(','), ...rows].join('\n')
}

export function downloadCsv(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
