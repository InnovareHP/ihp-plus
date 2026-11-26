import type { EventName } from '@/lib/analytics'

export const analyticsEvents = {
  reportLoaded: 'websites.analytics.loaded',
  reportFailed: 'websites.analytics.load_failed',
  takeawaysSaved: 'websites.takeaways.saved',
  takeawaysSaveFailed: 'websites.takeaways.save_failed',
  pdfDownloaded: 'websites.report_pdf.downloaded',
  pdfFailed: 'websites.report_pdf.failed',
  zipDownloaded: 'websites.report_zip.downloaded',
  zipFailed: 'websites.report_zip.failed',
} as const satisfies Record<string, EventName>
