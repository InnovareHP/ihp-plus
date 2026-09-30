import { track } from '@/lib/analytics'
import { downloadFile } from '@/lib/download'
import { attendanceEvents } from '../events'
import type { BillingStatementValues } from '../schema'
import {
  billingStatementHtml,
  loadStatementLetterhead,
  printHtml,
  statementFileName,
  type StatementPeriod,
} from './billing-statement'
import { statementEmail, statementEml } from './statement-email'

/** What a saved statement turns into: the print dialog, a PDF, or an email draft carrying it. */
export type StatementOutput = 'print' | 'pdf' | 'email'

const DONE = {
  print: attendanceEvents.statementPrinted,
  pdf: attendanceEvents.statementPdfDownloaded,
  email: attendanceEvents.statementEmailDrafted,
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

  downloadFile({
    fileName: `${name}.eml`,
    contentType: 'message/rfc822',
    bytes: new TextEncoder().encode(statementEml(statementEmail(values, period), pdf)),
  })
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
