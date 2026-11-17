import { formatUsd } from './billing-statement'
import type { MonthlyReport } from './monthly-report'
import type { StatementEmail } from './statement-email'

const hours = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** A short cover note; the detail travels in the PDF the sender attaches. */
export function monthlyReportEmail(
  report: MonthlyReport,
  title: string,
  fileName: string,
): StatementEmail {
  return {
    to: '',
    subject: `Monthly report — ${title}`,
    body: [
      'Hi,',
      '',
      `Attached is the monthly report for ${title} (${fileName}).`,
      '',
      `People: ${report.rows.length}`,
      `Total salary: ${formatUsd(report.totals.salaryCents)} USD`,
      `Tasks accomplished: ${report.totals.tasksDone}`,
      `Hours worked: ${hours.format(report.totals.hoursWorked)}`,
      '',
      'Each person’s hours, statements and tasks are in the PDF.',
    ].join('\n'),
  }
}
