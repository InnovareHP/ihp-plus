import { formatTimeOfDay } from '@ihp/clock'
import {
  CHECK_ROUNDS,
  CHECK_ROUND_LABELS,
  CHECK_STATUS_LABELS,
  type MonthExport,
  type WebsiteCheckRow,
} from '../schema'
import { describeReading } from './verdict'

const ROUND_COLUMNS = ['status', 'checked at', 'checked by', 'reading', 'note'] as const

const HEADERS = [
  'Date',
  'Client',
  'Website',
  'URL',
  ...CHECK_ROUNDS.flatMap((round) =>
    ROUND_COLUMNS.map((column) => `${CHECK_ROUND_LABELS[round]} ${column}`),
  ),
]

// A leading =, +, - or @ makes a spreadsheet treat the text as a formula, so it is defused.
function cell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function roundCells(check: WebsiteCheckRow | undefined, timeZone: string): string[] {
  if (!check) return ['Not checked', '', '', '', '']
  return [
    CHECK_STATUS_LABELS[check.status],
    formatTimeOfDay(check.checkedAt, timeZone),
    check.checkedByName,
    describeReading(check),
    check.note,
  ]
}

/** Every site on every day of the month, unchecked rounds included so a gap is visible. */
export function monthCsv(file: MonthExport): string {
  const rows = file.rows.map((row) =>
    [
      row.date,
      row.client,
      row.website,
      row.url,
      ...CHECK_ROUNDS.flatMap((round) => roundCells(row.checks[round], file.timeZone)),
    ]
      .map(cell)
      .join(','),
  )
  return [HEADERS.map(cell).join(','), ...rows].join('\n')
}

export function monthCsvName(month: string) {
  return `website-checks-${month}.csv`
}
