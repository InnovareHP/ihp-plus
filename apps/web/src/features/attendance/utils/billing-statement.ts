import type { AttendanceAbsenceRow, AttendanceDayRow, BillingStatementValues } from '../schema'

export const STATEMENT_COMPANY = 'Innovare HP'

export interface StatementPeriod {
  from: string
  to: string
}

export interface StatementTotals {
  regularCents: number
  expensesCents: number
  totalCents: number
}

/**
 * A day counts once it has time on it, however many punches it took; a paid day off counts as a
 * day too, since payroll pays it, but adds no hours.
 */
export function timeWorked(
  days: readonly AttendanceDayRow[],
  absences: readonly AttendanceAbsenceRow[] = [],
) {
  const worked = new Set(days.filter((day) => day.workedSeconds > 0).map((day) => day.workDate))
  const paidOff = new Set(
    absences
      .filter(
        (absence) => absence.kind === 'leave' && absence.paid && !worked.has(absence.workDate),
      )
      .map((absence) => absence.workDate),
  )
  const seconds = days.reduce((sum, day) => sum + day.workedSeconds, 0)
  return {
    daysWorked: worked.size + paidOff.size,
    hoursWorked: Math.round((seconds / 3600) * 100) / 100,
    paidDaysOff: paidOff.size,
  }
}

export function statementTotals(
  values: Pick<BillingStatementValues, 'daysWorked' | 'dailyRateCents' | 'bonusCents' | 'expenses'>,
): StatementTotals {
  const regularCents = Math.round((values.daysWorked || 0) * (values.dailyRateCents || 0))
  const expensesCents = values.expenses.reduce((sum, row) => sum + (row.amountCents || 0), 0)
  return {
    regularCents,
    expensesCents,
    totalCents: regularCents + (values.bonusCents || 0) + expensesCents,
  }
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatUsd(cents: number) {
  return usd.format(cents / 100)
}

const longDate = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatStatementDate(dateKey: string) {
  return longDate.format(new Date(`${dateKey}T00:00:00Z`))
}

export function defaultInvoiceNumber(to: string) {
  return `INV-${to.replaceAll('-', '')}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function row(label: string, value: string, strong = false) {
  const cell = strong ? 'th' : 'td'
  return `<tr><${cell} scope="row">${escapeHtml(label)}</${cell}><${cell} class="num">${escapeHtml(value)}</${cell}></tr>`
}

/** The statement as a standalone page, laid out like the template contractors already send. */
export function billingStatementHtml(values: BillingStatementValues, period: StatementPeriod) {
  const totals = statementTotals(values)
  const expenseRows = values.expenses.map((expense) =>
    row(expense.description, formatUsd(expense.amountCents)),
  )
  const link = escapeHtml(values.wiseLink)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Billing statement ${escapeHtml(values.invoiceNumber)}</title>
<style>
  @page { margin: 18mm; }
  body { font-family: Poppins, Arial, sans-serif; color: #222222; font-size: 13px; margin: 0; }
  h1 { color: #1346c5; font-size: 24px; letter-spacing: 0.04em; margin: 0 0 16px; }
  h2 { color: #0b286b; font-size: 14px; letter-spacing: 0.06em; margin: 28px 0 8px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
  dt { font-weight: 600; }
  dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #dce7ff; }
  thead th { background: #dce7ff; color: #0b286b; }
  .num { text-align: right; }
  .total th { background: #1346c5; color: #ffffff; font-size: 15px; }
  a { color: #1346c5; word-break: break-all; }
</style>
</head>
<body>
<h1>BILLING STATEMENT</h1>
<dl>
  <dt>Contractor:</dt><dd>${escapeHtml(values.contractorName)}</dd>
  <dt>Position / Role:</dt><dd>${escapeHtml(values.position)}</dd>
  <dt>Company:</dt><dd>${STATEMENT_COMPANY}</dd>
  <dt>Billing Period:</dt><dd>${formatStatementDate(period.from)} – ${formatStatementDate(period.to)}</dd>
  <dt>Invoice Date:</dt><dd>${formatStatementDate(values.invoiceDate)}</dd>
</dl>

<h2>WORK SUMMARY</h2>
<table>
  <thead><tr><th scope="col">Description</th><th scope="col" class="num">Details</th></tr></thead>
  <tbody>
    ${row('Days Worked', `${values.daysWorked} ${values.daysWorked === 1 ? 'day' : 'days'}`)}
    ${row('Total Hours Worked', `${values.hoursWorked.toFixed(2)} hours`)}
    ${row('Daily Rate', formatUsd(values.dailyRateCents))}
    ${row('Regular Compensation', formatUsd(totals.regularCents))}
  </tbody>
</table>

<h2>COMPENSATION</h2>
<table>
  <thead><tr><th scope="col">Description</th><th scope="col" class="num">Amount</th></tr></thead>
  <tbody>
    ${row('Regular Compensation', formatUsd(totals.regularCents))}
    ${row('Bonus', formatUsd(values.bonusCents))}
    ${expenseRows.join('\n    ')}
  </tbody>
  <tfoot class="total">${row('TOTAL AMOUNT DUE', `${formatUsd(totals.totalCents)} USD`, true)}</tfoot>
</table>

<h2>PAYMENT DETAILS</h2>
<dl>
  <dt>Payment Method:</dt><dd>Wise</dd>
  <dt>Payment Link:</dt><dd><a href="${link}">${link}</a></dd>
  <dt>Payment Currency:</dt><dd>USD</dd>
  <dt>Payment Reference:</dt><dd>${escapeHtml(values.invoiceNumber)}</dd>
</dl>
</body>
</html>`
}

/** A hidden frame prints the page on its own, so no popup blocker and none of the app's chrome. */
export function printHtml(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.addEventListener('load', () => {
    frame.contentWindow?.print()
    // Printing blocks until the dialog closes, so the frame can go straight after.
    setTimeout(() => frame.remove(), 1000)
  })
  frame.srcdoc = html
  document.body.append(frame)
}
