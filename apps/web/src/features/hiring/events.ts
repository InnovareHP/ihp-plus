import type { EventName } from '@/lib/analytics'

export const hiringEvents = {
  settingsSaved: 'hiring.settings.saved',
  settingsSaveFailed: 'hiring.settings.save_failed',
  postingCreated: 'hiring.posting.created',
  postingSaved: 'hiring.posting.saved',
  postingSaveFailed: 'hiring.posting.save_failed',
  postingOpened: 'hiring.posting.opened',
  postingClosed: 'hiring.posting.closed',
  postingArchived: 'hiring.posting.archived',
  postingStatusFailed: 'hiring.posting.status_failed',
  postingDeleted: 'hiring.posting.deleted',
  postingDeleteFailed: 'hiring.posting.delete_failed',
  applyStarted: 'hiring.application.started',
  applied: 'hiring.application.submitted',
  applyFailed: 'hiring.application.submit_failed',
  fileUploaded: 'hiring.application.file_uploaded',
  fileUploadFailed: 'hiring.application.file_upload_failed',
  withdrawn: 'hiring.application.withdrawn',
  withdrawFailed: 'hiring.application.withdraw_failed',
} as const satisfies Record<string, EventName>
