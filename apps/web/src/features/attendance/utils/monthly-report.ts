import type { BillingStatementRow, EmployeeSummaryRow, SummaryTaskRow } from '../schema'
import { datesOfMonth } from './calendar'

export interface MonthlyReportRow {
  userId: string
  userName: string
  jobTitle: string | undefined
  daysWorked: number
  hoursWorked: number
  tasksPlanned: number
  accomplished: SummaryTaskRow[]
  outstanding: SummaryTaskRow[]
  statements: BillingStatementRow[]
  salaryCents: number
  statementCount: number
}

export interface MonthlyReport {
  rows: MonthlyReportRow[]
  totals: { hoursWorked: number; tasksDone: number; salaryCents: number }
}

/** The first and last date of a YYYY-MM month. */
export function monthRange(month: string) {
  const dates = datesOfMonth(month)
  return { from: dates[0] ?? `${month}-01`, to: dates.at(-1) ?? `${month}-01` }
}

/**
 * Pay comes from filed statements because rates are not stored; a statement is counted in the
 * month its period ends so one spanning two months is never paid twice.
 */
export function monthlyReport(summaries: readonly EmployeeSummaryRow[], month: string) {
  const rows = summaries.map((summary): MonthlyReportRow => {
    const statements = summary.statements.filter((row) => row.periodEnd.startsWith(month))
    return {
      userId: summary.userId,
      userName: summary.userName,
      jobTitle: summary.jobTitle,
      daysWorked: summary.daysWorked,
      hoursWorked: summary.hoursWorked,
      tasksPlanned: summary.tasks.length,
      accomplished: summary.tasks.filter((task) => task.isDone),
      outstanding: summary.tasks.filter((task) => !task.isDone),
      statements,
      salaryCents: statements.reduce((sum, row) => sum + row.totalCents, 0),
      statementCount: statements.length,
    }
  })
  return {
    rows,
    totals: {
      hoursWorked: Math.round(rows.reduce((sum, row) => sum + row.hoursWorked, 0) * 100) / 100,
      tasksDone: rows.reduce((sum, row) => sum + row.accomplished.length, 0),
      salaryCents: rows.reduce((sum, row) => sum + row.salaryCents, 0),
    },
  } satisfies MonthlyReport
}
