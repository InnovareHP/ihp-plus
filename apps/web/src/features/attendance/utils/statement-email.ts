import type { BillingStatementValues } from '../schema'
import {
  formatStatementDate,
  formatUsd,
  statementTotals,
  type StatementPeriod,
} from './billing-statement'

export interface StatementEmail {
  /** Empty leaves the recipient for the contractor to fill in their mail app. */
  to: string
  subject: string
  body: string
}

export function statementEmail(
  values: BillingStatementValues,
  period: StatementPeriod,
): StatementEmail {
  const totals = statementTotals(values)
  return {
    to: values.sendTo,
    subject: `Billing statement ${values.invoiceNumber} — ${values.contractorName}`,
    body: [
      'Hi,',
      '',
      `Please find attached my billing statement for ${formatStatementDate(period.from)} – ${formatStatementDate(period.to)}.`,
      '',
      `Invoice: ${values.invoiceNumber}`,
      `Total due: ${formatUsd(totals.totalCents)} USD`,
      `Pay via Wise: ${values.wiseLink}`,
      '',
      'Thanks,',
      values.contractorName,
    ].join('\n'),
  }
}

/** A mailto link carries no attachment, so the PDF is downloaded beside it to attach by hand. */
export function statementMailto(email: StatementEmail) {
  const query = [
    `subject=${encodeURIComponent(email.subject)}`,
    // Mail clients expect CRLF line breaks in a mailto body.
    `body=${encodeURIComponent(email.body.replaceAll('\n', '\r\n'))}`,
  ].join('&')
  return `mailto:${encodeURIComponent(email.to)}?${query}`
}
