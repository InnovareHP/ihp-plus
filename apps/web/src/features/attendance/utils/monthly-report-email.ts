import { formatStatementDate, formatUsd } from './billing-statement'
import type { MonthlyReport } from './monthly-report'
import type { StatementEmail } from './statement-email'

const hours = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** The whole monthly report as plain text, addressed by whoever sends it. */
export function monthlyReportEmail(report: MonthlyReport, title: string): StatementEmail {
  const people = report.rows.flatMap((row) => [
    '',
    row.jobTitle ? `${row.userName} (${row.jobTitle})` : row.userName,
    `- Days worked: ${row.daysWorked} · Hours worked: ${hours.format(row.hoursWorked)}`,
    `- Tasks done: ${row.accomplished.length} of ${row.tasksPlanned}`,
    `- Salary: ${formatUsd(row.salaryCents)} (${row.statementCount} ${row.statementCount === 1 ? 'statement' : 'statements'})`,
    ...(row.accomplished.length > 0
      ? [
          '- Accomplished:',
          ...row.accomplished.map(
            (task) => `    • ${formatStatementDate(task.dueDate)} — ${task.name}`,
          ),
        ]
      : []),
  ])

  return {
    to: '',
    subject: `Monthly report — ${title}`,
    body: [
      `Monthly report · ${title}`,
      '',
      `Total salary: ${formatUsd(report.totals.salaryCents)}`,
      `Tasks accomplished: ${report.totals.tasksDone}`,
      `Hours worked: ${hours.format(report.totals.hoursWorked)}`,
      ...people,
    ].join('\n'),
  }
}
