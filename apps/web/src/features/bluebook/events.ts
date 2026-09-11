import type { EventName } from '@/lib/analytics'

export const bluebookEvents = {
  uploaded: 'bluebook.document.uploaded',
  uploadFailed: 'bluebook.document.upload_failed',
  updated: 'bluebook.document.updated',
  updateFailed: 'bluebook.document.update_failed',
  archived: 'bluebook.document.archived',
  archiveFailed: 'bluebook.document.archive_failed',
  restored: 'bluebook.document.restored',
  restoreFailed: 'bluebook.document.restore_failed',
  purged: 'bluebook.document.purged',
  purgeFailed: 'bluebook.document.purge_failed',
  opened: 'bluebook.document.opened',
  openFailed: 'bluebook.document.open_failed',
} as const satisfies Record<string, EventName>
