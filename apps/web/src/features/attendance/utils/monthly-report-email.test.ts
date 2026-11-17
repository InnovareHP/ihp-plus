import { describe, expect, it } from 'vitest'
import { monthlyReportEmail } from './monthly-report-email'
import type { MonthlyReport } from './monthly-report'

const REPORT: MonthlyReport = {
  rows: [
    {
      userId: 'dana',
      userName: 'Dana Reyes',
      jobTitle: 'Nurse',
      daysWorked: 21,
      hoursWorked: 168.5,
      tasksPlanned: 2,
      accomplished: [{ id: 't1', name: 'Chart reviews', dueDate: '2026-10-03', isDone: true }],
      salaryCents: 420_000,
      statementCount: 1,
    },
    {
      userId: 'eli',
      userName: 'Eli Cruz',
      jobTitle: undefined,
      daysWorked: 0,
      hoursWorked: 0,
      tasksPlanned: 0,
      accomplished: [],
      salaryCents: 0,
      statementCount: 0,
    },
  ],
  totals: { hoursWorked: 168.5, tasksDone: 1, salaryCents: 420_000 },
}

describe('monthlyReportEmail', () => {
  it('writes the totals and every person, leaving the recipient to the sender', () => {
    const email = monthlyReportEmail(REPORT, 'October 2026')

    expect(email.to).toBe('')
    expect(email.subject).toBe('Monthly report — October 2026')
    expect(email.body).toContain('Total salary: $4,200.00')
    expect(email.body).toContain('Hours worked: 168.5')
    expect(email.body).toContain('Dana Reyes (Nurse)')
    expect(email.body).toContain('- Tasks done: 1 of 2')
    expect(email.body).toContain('- Salary: $4,200.00 (1 statement)')
    expect(email.body).toContain('October 3, 2026 — Chart reviews')
    expect(email.body).toContain('\nEli Cruz\n')
    expect(email.body).toContain('- Salary: $0.00 (0 statements)')
  })
})
