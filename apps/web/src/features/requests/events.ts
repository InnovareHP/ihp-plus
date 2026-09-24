import type { EventName } from '@/lib/analytics'

export const requestEvents = {
  formSaved: 'requests.form.saved',
  formSaveFailed: 'requests.form.save_failed',
  formPublished: 'requests.form.published',
  formPublishFailed: 'requests.form.publish_failed',
  formDeleted: 'requests.form.deleted',
  formDeleteFailed: 'requests.form.delete_failed',
  requestStarted: 'requests.request.started',
  requestSubmitted: 'requests.request.submitted',
  requestSubmitFailed: 'requests.request.submit_failed',
  fileUploaded: 'requests.file.uploaded',
  fileUploadFailed: 'requests.file.upload_failed',
  requestWithdrawn: 'requests.request.withdrawn',
  requestWithdrawFailed: 'requests.request.withdraw_failed',
  requestDecided: 'requests.request.decided',
  requestDecideFailed: 'requests.request.decide_failed',
  leaveCancelled: 'requests.leave.cancelled',
  leaveCancelFailed: 'requests.leave.cancel_failed',
  approverAdded: 'requests.approver.added',
  approverChangeFailed: 'requests.approver.change_failed',
} as const satisfies Record<string, EventName>
