import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { BillingStatementRow, SummaryTaskRow } from '../schema'
import type { MonthlyReport, MonthlyReportRow } from './monthly-report'
import { monthlyReportFileName, monthlyReportPdf } from './monthly-report-pdf'

function task(index: number, isDone: boolean): SummaryTaskRow {
  return { id: `t${index}`, name: `Task ${index}`, dueDate: '2026-10-03', isDone }
}

function person(overrides: Partial<MonthlyReportRow> = {}): MonthlyReportRow {
  return {
    userId: 'dana',
    userName: 'Dana Reyes',
    jobTitle: 'Nurse',
    daysWorked: 21,
    hoursWorked: 168,
    tasksPlanned: 2,
    accomplished: [task(1, true)],
    outstanding: [task(2, false)],
    statements: [
      {
        invoiceNumber: 'INV-20261031',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        totalCents: 420_000,
      } as BillingStatementRow,
    ],
    salaryCents: 420_000,
    statementCount: 1,
    ...overrides,
  }
}

function reportOf(rows: MonthlyReportRow[]): MonthlyReport {
  return { rows, totals: { hoursWorked: 168, tasksDone: 1, salaryCents: 420_000 } }
}

describe('monthlyReportPdf', () => {
  it('builds a letterhead PDF titled with the month', async () => {
    const bytes = await monthlyReportPdf(
      reportOf([person(), person({ userId: 'eli', userName: 'Eli Cruz', statements: [] })]),
      'October 2026',
      '2026-11-18',
    )
    const document = await PDFDocument.load(bytes)

    expect(document.getTitle()).toBe('Monthly report — October 2026')
    expect(document.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('runs onto more pages rather than into the footer', async () => {
    const accomplished = Array.from({ length: 40 }, (_, index) => task(index, true))
    const document = await PDFDocument.load(
      await monthlyReportPdf(
        reportOf([person({ accomplished, tasksPlanned: 40, outstanding: [] })]),
        'October 2026',
        '2026-11-18',
      ),
    )

    expect(document.getPageCount()).toBeGreaterThan(1)
  })

  it('names the file by month', () => {
    expect(monthlyReportFileName('2026-10')).toBe('monthly-report-2026-10')
  })
})
