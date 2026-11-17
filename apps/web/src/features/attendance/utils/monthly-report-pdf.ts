import { PDFDocument } from 'pdf-lib'
import { STATEMENT_COMPANY, formatStatementDate, formatUsd } from './billing-statement'
import {
  BRAND,
  NAVY,
  letterheadKit,
  letterheadWriter,
  type TableRow,
} from './billing-statement-pdf'
import { completionRate } from './daily-task-kpis'
import type { MonthlyReport, MonthlyReportRow } from './monthly-report'

const hours = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
// Short dates keep an invoice number and its period inside half the table width.
const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function short(dateKey: string) {
  return shortDate.format(new Date(`${dateKey}T00:00:00Z`))
}

export function monthlyReportFileName(month: string) {
  return `monthly-report-${month}`
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

function tasksDone(done: number, planned: number) {
  const rate = completionRate(done, planned)
  return `${done} of ${planned}${rate === undefined ? '' : ` (${rate}%)`}`
}

function taskRows(tasks: MonthlyReportRow['accomplished']): TableRow[] {
  return tasks.map((task) => ({ label: task.name, value: formatStatementDate(task.dueDate) }))
}

/** The month's report on the letterhead: company totals first, then one section per person. */
export async function monthlyReportPdf(
  report: MonthlyReport,
  title: string,
  preparedOn: string,
): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(`Monthly report — ${title}`)
  document.setSubject(`Attendance, tasks and pay for ${title}`)
  document.setCreator(STATEMENT_COMPANY)

  const draw = letterheadWriter(document, await letterheadKit(document))
  const planned = report.rows.reduce((sum, row) => sum + row.tasksPlanned, 0)
  const days = report.rows.reduce((sum, row) => sum + row.daysWorked, 0)

  draw.heading('MONTHLY REPORT', 20, BRAND, 0)
  draw.details([
    { label: 'Company:', value: STATEMENT_COMPANY },
    { label: 'Month:', value: title },
    { label: 'Prepared on:', value: formatStatementDate(preparedOn) },
    { label: 'People:', value: String(report.rows.length) },
  ])

  draw.heading('OVERVIEW', 12, NAVY, 22)
  draw.table(
    { label: 'Measure', value: 'Total' },
    [
      { label: 'Days worked', value: plural(days, 'day', 'days') },
      { label: 'Hours worked', value: `${hours.format(report.totals.hoursWorked)} hours` },
      {
        label: 'Tasks accomplished',
        value: tasksDone(report.totals.tasksDone, planned),
      },
    ],
    { label: 'TOTAL SALARY', value: `${formatUsd(report.totals.salaryCents)} USD` },
  )

  draw.heading('TEAM SUMMARY', 12, NAVY, 22)
  draw.table(
    { label: 'Employee', value: 'Hours · Tasks done · Salary' },
    report.rows.map((row) => ({
      label: row.userName,
      value: `${hours.format(row.hoursWorked)} h · ${row.accomplished.length}/${row.tasksPlanned} · ${formatUsd(row.salaryCents)}`,
    })),
  )

  for (const row of report.rows) {
    draw.heading(row.userName.toUpperCase(), 12, BRAND, 28)
    draw.details([
      { label: 'Position:', value: row.jobTitle ?? '—' },
      { label: 'Days worked:', value: plural(row.daysWorked, 'day', 'days') },
      { label: 'Hours worked:', value: `${hours.format(row.hoursWorked)} hours` },
      { label: 'Tasks done:', value: tasksDone(row.accomplished.length, row.tasksPlanned) },
      { label: 'Salary:', value: `${formatUsd(row.salaryCents)} USD` },
    ])

    draw.heading('Billing statements', 10, NAVY, 14)
    if (row.statements.length === 0) {
      draw.details([{ label: '', value: 'No statement filed with a period ending this month.' }])
    } else {
      draw.table(
        { label: 'Invoice · Period', value: 'Amount' },
        row.statements.map((statement) => ({
          label: `${statement.invoiceNumber} · ${short(statement.periodStart)} – ${short(statement.periodEnd)}`,
          value: formatUsd(statement.totalCents),
        })),
        { label: 'Total', value: `${formatUsd(row.salaryCents)} USD` },
      )
    }

    draw.heading('Accomplished tasks', 10, NAVY, 14)
    if (row.accomplished.length === 0) {
      draw.details([{ label: '', value: 'No tasks marked done this month.' }])
    } else {
      draw.table({ label: 'Task', value: 'Day' }, taskRows(row.accomplished))
    }

    if (row.outstanding.length > 0) {
      draw.heading('Not completed', 10, NAVY, 14)
      draw.table({ label: 'Task', value: 'Day' }, taskRows(row.outstanding))
    }
  }

  return document.save()
}
