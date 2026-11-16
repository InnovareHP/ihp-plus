import { describe, expect, it } from 'vitest'
import type { BillingStatementRow, EmployeeSummaryRow } from '../schema'
import { monthRange, monthlyReport } from './monthly-report'

const statement = (periodEnd: string, totalCents: number) =>
  ({ periodEnd, totalCents }) as BillingStatementRow

const DANA: EmployeeSummaryRow = {
  userId: 'dana',
  userName: 'Dana Reyes',
  jobTitle: 'Nurse',
  daysWorked: 20,
  hoursWorked: 160.5,
  paidDaysOff: 0,
  tasks: [
    { id: 't1', name: 'Chart reviews', dueDate: '2026-11-03', isDone: true },
    { id: 't2', name: 'Call families', dueDate: '2026-11-03', isDone: false },
  ],
  statements: [
    statement('2026-10-31', 999_00),
    statement('2026-11-15', 1_000_00),
    statement('2026-11-30', 1_200_00),
  ],
}

describe('monthRange', () => {
  it('spans the first to the last day, leap years included', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})

describe('monthlyReport', () => {
  it('counts only done tasks and statements whose period ends in the month', () => {
    const report = monthlyReport([DANA], '2026-11')
    expect(report.rows[0]).toMatchObject({
      tasksPlanned: 2,
      accomplished: [{ id: 't1' }],
      salaryCents: 2_200_00,
      statementCount: 2,
    })
    expect(report.totals).toEqual({ hoursWorked: 160.5, tasksDone: 1, salaryCents: 2_200_00 })
  })

  it('is all zeros for nobody', () => {
    expect(monthlyReport([], '2026-11').totals).toEqual({
      hoursWorked: 0,
      tasksDone: 0,
      salaryCents: 0,
    })
  })
})
