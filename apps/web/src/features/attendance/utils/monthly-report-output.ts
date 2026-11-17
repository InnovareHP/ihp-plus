import { track } from '@/lib/analytics'
import { downloadFile } from '@/lib/download'
import { openMailto } from '@/lib/mailto'
import { attendanceEvents } from '../events'
import type { MonthlyReport } from './monthly-report'
import { monthlyReportEmail } from './monthly-report-email'
import { statementMailto } from './statement-email'

export type MonthlyReportOutput = 'pdf' | 'email'

export interface MonthlyReportExport {
  output: MonthlyReportOutput
  report: MonthlyReport
  month: string
  title: string
}

/** Downloads the report PDF and, for email, opens a cover note to attach it to; throws on failure. */
export async function exportMonthlyReport({ output, report, month, title }: MonthlyReportExport) {
  try {
    // Loaded on demand, so pdf-lib and the letterhead art stay out of the page bundle.
    const { monthlyReportFileName, monthlyReportPdf } = await import('./monthly-report-pdf')
    const fileName = `${monthlyReportFileName(month)}.pdf`
    const today = new Date().toISOString().slice(0, 10)
    downloadFile({
      fileName,
      contentType: 'application/pdf',
      bytes: await monthlyReportPdf(report, title, today),
    })
    if (output === 'email') openMailto(statementMailto(monthlyReportEmail(report, title, fileName)))
    track(
      output === 'email'
        ? attendanceEvents.monthlyReportEmailOpened
        : attendanceEvents.monthlyReportPdfDownloaded,
      { people: report.rows.length },
    )
    return fileName
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown'
    track(attendanceEvents.monthlyReportExportFailed, { output, reason })
    throw error
  }
}
