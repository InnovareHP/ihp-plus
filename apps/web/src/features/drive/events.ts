import type { EventName } from '@/lib/analytics'

export const driveEvents = {
  sweepStarted: 'drive.mirror.sweep_started',
  sweepFinished: 'drive.mirror.sweep_finished',
  sweepFailed: 'drive.mirror.sweep_failed',
  notificationRejected: 'drive.webhook.notification_rejected',
  subscriptionCreated: 'drive.subscription.created',
  subscriptionRenewed: 'drive.subscription.renewed',
  subscriptionRenewFailed: 'drive.subscription.renew_failed',
  clientFolderCreated: 'drive.client_folder.created',
  internalFolderFailed: 'drive.client_folder.internal_failed',
  accessShared: 'drive.client_access.shared',
  accessShareFailed: 'drive.client_access.share_failed',
  accessRevoked: 'drive.client_access.revoked',
  accessRevokeFailed: 'drive.client_access.revoke_failed',
  groupCreated: 'drive.client_group.created',
  groupCreateFailed: 'drive.client_group.create_failed',
  groupMemberAdded: 'drive.client_group.member_added',
  groupMemberRemoved: 'drive.client_group.member_removed',
  groupMemberFailed: 'drive.client_group.member_failed',
  groupDeleted: 'drive.client_group.deleted',
  groupDeleteFailed: 'drive.client_group.delete_failed',
} as const satisfies Record<string, EventName>
