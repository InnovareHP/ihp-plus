'use client'

import { Button } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { downloadFile } from '@/lib/download'
import { draftEvents } from '../events'

export interface DownloadDraftButtonProps {
  title: string
  body: string
  missingCount: number
}

export function DownloadDraftButton({ title, body, missingCount }: DownloadDraftButtonProps) {
  const download = useMutation({
    mutationFn: async () => {
      // Loaded on demand, so pdf-lib and the letterhead art stay out of the chat's bundle.
      const { draftPdf } = await import('../utils/draft-pdf')
      downloadFile({
        fileName: `${title.replace(/[\\/:*?"<>|]+/g, '-')}.pdf`,
        contentType: 'application/pdf',
        bytes: await draftPdf(title, body),
      })
    },
    onSuccess: () => track(draftEvents.pdfDownloaded, { missing: missingCount }),
    onError: (error: Error) => {
      track(draftEvents.pdfFailed, { reason: error.message })
      announceFailure('Could not build the PDF — try again.')
    },
  })

  return (
    <Button
      leftSection={<IconDownload size={16} aria-hidden />}
      loading={download.isPending}
      onClick={() => download.mutate()}
    >
      Download PDF
    </Button>
  )
}
