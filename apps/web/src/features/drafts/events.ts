import type { EventName } from '@/lib/analytics'

export const draftEvents = {
  created: 'drafts.draft.created',
  createFailed: 'drafts.draft.create_failed',
  messageSent: 'drafts.message.sent',
  messageFailed: 'drafts.message.send_failed',
  undone: 'drafts.change.undone',
  undoFailed: 'drafts.change.undo_failed',
  pdfDownloaded: 'drafts.pdf.downloaded',
  pdfFailed: 'drafts.pdf.download_failed',
} as const satisfies Record<string, EventName>
