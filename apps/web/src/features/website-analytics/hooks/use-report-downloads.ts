'use client'

import { useMutation } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { downloadFile } from '@/lib/download'
import { downloadAllReports, downloadReportPdf } from '../actions'
import type { DayRange } from '../days'
import { analyticsEvents } from '../events'

export function useDownloadReportPdf(siteKey: string, range: DayRange) {
  return useMutation({
    mutationFn: async () => {
      const result = await downloadReportPdf(siteKey, range.start, range.end)
      if (!result.ok) throw new Error(result.message)
      downloadFile({ ...result.data, contentType: 'application/pdf' })
    },
    onSuccess: () => track(analyticsEvents.pdfDownloaded, { siteKey }),
    onError: (error: Error) => {
      track(analyticsEvents.pdfFailed, { siteKey })
      announceFailure(error.message)
    },
  })
}

/** Resolves to the sites the zip had to leave out, so the screen can name them. */
export function useDownloadAllReports(range: DayRange) {
  return useMutation({
    mutationFn: async () => {
      const result = await downloadAllReports(range.start, range.end)
      if (!result.ok) throw new Error(result.message)
      const { failed, ...file } = result.data
      downloadFile({ ...file, contentType: 'application/zip' })
      return failed
    },
    onSuccess: (failed) => track(analyticsEvents.zipDownloaded, { failed: failed.length }),
    onError: (error: Error) => {
      track(analyticsEvents.zipFailed, {})
      announceFailure(error.message)
    },
  })
}
