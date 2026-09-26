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

/** A fixed rate is billed whole whatever the days; a daily one is days × the rate. */
export function statementTotals(
  values: Pick<
    BillingStatementValues,
    'fixedPay' | 'daysWorked' | 'dailyRateCents' | 'bonusCents' | 'expenses'
  >,
): StatementTotals {
  const rate = values.dailyRateCents || 0
  const regularCents = values.fixedPay ? rate : Math.round((values.daysWorked || 0) * rate)
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

/** The official letterhead's header band and footer strip, as image sources and their proportions. */
export interface StatementLetterhead {
  header: { src: string; width: number; height: number }
  footer: { src: string; width: number; height: number }
}

// Loaded on print only, so the art does not ride in the time clock's bundle.
export async function loadStatementLetterhead(): Promise<StatementLetterhead> {
  const { LETTERHEAD_ARTWORK } = await import('@/features/letterhead/utils/letterhead-artwork')
  const art = (part: typeof LETTERHEAD_ARTWORK.header) => ({
    src: `data:image/png;base64,${part.base64}`,
    width: part.width,
    height: part.height,
  })
  return { header: art(LETTERHEAD_ARTWORK.header), footer: art(LETTERHEAD_ARTWORK.footer) }
}

// US Letter, which is the page the letterhead's Word original is set on.
const PAGE_WIDTH_IN = 8.5

function bandHeight(part: { width: number; height: number }) {
  return `${((PAGE_WIDTH_IN * part.height) / part.width).toFixed(3)}in`
}

/** The statement as a standalone page on the official letterhead, laid out like the template. */
export function billingStatementHtml(
  values: BillingStatementValues,
  period: StatementPeriod,
  letterhead?: StatementLetterhead,
) {
  const totals = statementTotals(values)
  const expenseRows = values.expenses.map((expense) =>
    row(expense.description, formatUsd(expense.amountCents)),
  )
  const link = escapeHtml(values.wiseLink)

  const header = letterhead ? bandHeight(letterhead.header) : '0in'
  const footer = letterhead ? bandHeight(letterhead.footer) : '0in'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Billing statement ${escapeHtml(values.invoiceNumber)}</title>
<style>
  @page { size: letter; margin: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Poppins, Arial, sans-serif; color: #222222; font-size: 13px; margin: 0; }
  .band { position: fixed; left: 0; width: 100%; display: block; }
  .band-top { top: 0; }
  .band-bottom { bottom: 0; }
  .page { width: 100%; border-collapse: collapse; }
  .page > thead td { height: calc(${header} + 0.35in); padding: 0; border: 0; }
  .page > tfoot td { height: calc(${footer} + 0.35in); padding: 0; border: 0; }
  .page > tbody > tr > td { padding: 0 1in; border: 0; }
  h1 { color: #1346c5; font-size: 24px; letter-spacing: 0.04em; margin: 0 0 16px; }
  h2 { color: #0b286b; font-size: 14px; letter-spacing: 0.06em; margin: 28px 0 8px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
  dt { font-weight: 600; }
  dd { margin: 0; }
  .lines { width: 100%; border-collapse: collapse; }
  .lines th, .lines td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #dce7ff; }
  .lines thead th { background: #dce7ff; color: #0b286b; }
  .lines .num { text-align: right; }
  .lines .total th { background: #1346c5; color: #ffffff; font-size: 15px; }
  a { color: #1346c5; word-break: break-all; }
</style>
</head>
<body>
${
  letterhead
    ? `<img class="band band-top" src="${letterhead.header.src}" alt="">
<img class="band band-bottom" src="${letterhead.footer.src}" alt="">`
    : ''
}
<!-- The empty head and foot repeat on every printed page, keeping text clear of the art. -->
<table class="page" role="presentation">
  <thead><tr><td></td></tr></thead>
  <tfoot><tr><td></td></tr></tfoot>
  <tbody><tr><td>
      <h1>BILLING STATEMENT</h1>
      <dl>
        <dt>Contractor:</dt><dd>${escapeHtml(values.contractorName)}</dd>
        <dt>Position / Role:</dt><dd>${escapeHtml(values.position || '—')}</dd>
        <dt>Company:</dt><dd>${STATEMENT_COMPANY}</dd>
        <dt>Billing Period:</dt><dd>${formatStatementDate(period.from)} – ${formatStatementDate(period.to)}</dd>
        <dt>Invoice Date:</dt><dd>${formatStatementDate(values.invoiceDate)}</dd>
      </dl>

      <h2>WORK SUMMARY</h2>
      <table class="lines">
        <thead><tr><th scope="col">Description</th><th scope="col" class="num">Details</th></tr></thead>
        <tbody>
          ${row('Days Worked', `${values.daysWorked} ${values.daysWorked === 1 ? 'day' : 'days'}`)}
          ${row('Total Hours Worked', `${values.hoursWorked.toFixed(2)} hours`)}
          ${row(values.fixedPay ? 'Fixed Rate (per statement)' : 'Daily Rate', formatUsd(values.dailyRateCents))}
          ${row('Regular Compensation', formatUsd(totals.regularCents))}
        </tbody>
      </table>

      <h2>COMPENSATION</h2>
      <table class="lines">
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
  </td></tr></tbody>
</table>
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
