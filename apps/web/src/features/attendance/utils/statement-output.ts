import { track } from '@/lib/analytics'
import { downloadFile } from '@/lib/download'
import { openMailto } from '@/lib/mailto'
import { attendanceEvents } from '../events'
import { announceFailure, announceSuccess } from '@/lib/announce'
import type { BillingStatementRow, BillingStatementValues } from '../schema'
import {
  billingStatementHtml,
  loadStatementLetterhead,
  printHtml,
  statementFileName,
  type StatementPeriod,
} from './billing-statement'
import { statementEmail, statementMailto } from './statement-email'

/** What a saved statement turns into: the print dialog, a PDF, or an email in the mail app. */
export type StatementOutput = 'print' | 'pdf' | 'email'

const DONE = {
  print: attendanceEvents.statementPrinted,
  pdf: attendanceEvents.statementPdfDownloaded,
  email: attendanceEvents.statementEmailOpened,
} as const

async function produce(
  output: StatementOutput,
  values: BillingStatementValues,
  period: StatementPeriod,
) {
  if (output === 'print') {
    printHtml(billingStatementHtml(values, period, await loadStatementLetterhead()))
    return
  }

  // Loaded on demand, so pdf-lib and the letterhead art stay out of the time clock's bundle.
  const { billingStatementPdf } = await import('./billing-statement-pdf')
  const name = statementFileName(values)
  const pdf = {
    fileName: `${name}.pdf`,
    contentType: 'application/pdf',
    bytes: await billingStatementPdf(values, period),
  }
  if (output === 'pdf') {
    downloadFile(pdf)
    return
  }

  downloadFile(pdf)
  openMailto(statementMailto(statementEmail(values, period)))
}

/** Resolves false instead of throwing, so the caller only chooses what to tell the user. */
export async function deliverStatement(
  output: StatementOutput,
  values: BillingStatementValues,
  period: StatementPeriod,
  reprint = false,
) {
  try {
    await produce(output, values, period)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown'
    if (output === 'print') track(attendanceEvents.statementPrintFailed, { reason })
    else track(attendanceEvents.statementExportFailed, { output, reason })
    return false
  }
  track(DONE[output], {
    days: values.daysWorked,
    hours: values.hoursWorked,
    expenses: values.expenses.length,
    reprint,
  })
  return true
}

const FAILED: Record<StatementOutput, string> = {
  print: 'Could not open the print view — allow printing for this site and try again.',
  pdf: 'Could not create the PDF — try again.',
  email: 'Could not start the email — try again.',
}

/** A saved statement produced again, with the outcome announced. */
export async function reissueStatement(statement: BillingStatementRow, output: StatementOutput) {
  const period = { from: statement.periodStart, to: statement.periodEnd }
  if (!(await deliverStatement(output, statement, period, true))) {
    announceFailure(FAILED[output])
    return
  }
  // The print dialog speaks for itself; a download lands silently, so it is announced.
  if (output === 'pdf') announceSuccess(`Downloaded ${statementFileName(statement)}.pdf.`)
  if (output === 'email') {
    announceSuccess(
      `Your mail app is opening. Attach the downloaded ${statementFileName(statement)}.pdf and send it.`,
    )
  }
}
