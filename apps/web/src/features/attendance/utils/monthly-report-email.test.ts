import { describe, expect, it } from 'vitest'
import type { MonthlyReport } from './monthly-report'
import { monthlyReportEmail } from './monthly-report-email'

const REPORT: MonthlyReport = {
  rows: [],
  totals: { hoursWorked: 168.5, tasksDone: 3, salaryCents: 420_000 },
}

describe('monthlyReportEmail', () => {
  it('writes a cover note naming the attachment, leaving the recipient to the sender', () => {
    const email = monthlyReportEmail(REPORT, 'October 2026', 'monthly-report-2026-10.pdf')

    expect(email.to).toBe('')
    expect(email.subject).toBe('Monthly report — October 2026')
    expect(email.body).toContain('monthly-report-2026-10.pdf')
    expect(email.body).toContain('Total salary: $4,200.00 USD')
    expect(email.body).toContain('Hours worked: 168.5')
  })
})
