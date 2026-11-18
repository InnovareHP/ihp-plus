import type { EventName } from '@/lib/analytics'

export const digestEvents = {
  settingsSaved: 'security_digest.settings.saved',
  settingsSaveFailed: 'security_digest.settings.save_failed',
  draftRequested: 'security_digest.draft.requested',
  draftCreated: 'security_digest.draft.created',
  draftFailed: 'security_digest.draft.failed',
  approved: 'security_digest.issue.approved',
  approveFailed: 'security_digest.issue.approve_failed',
  rejected: 'security_digest.issue.rejected',
  rejectFailed: 'security_digest.issue.reject_failed',
  reopened: 'security_digest.issue.reopened',
  reopenFailed: 'security_digest.issue.reopen_failed',
  deleted: 'security_digest.issue.deleted',
  deleteFailed: 'security_digest.issue.delete_failed',
  sent: 'security_digest.issue.sent',
  sendFailed: 'security_digest.issue.send_failed',
  testSent: 'security_digest.test.sent',
  testFailed: 'security_digest.test.failed',
} as const satisfies Record<string, EventName>
