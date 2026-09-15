import type { EventName } from '@/lib/analytics'

export const driveEvents = {
  sweepStarted: 'drive.mirror.sweep_started',
  sweepFinished: 'drive.mirror.sweep_finished',
  sweepFailed: 'drive.mirror.sweep_failed',
  notificationRejected: 'drive.webhook.notification_rejected',
  subscriptionCreated: 'drive.subscription.created',
  subscriptionRenewed: 'drive.subscription.renewed',
  subscriptionRenewFailed: 'drive.subscription.renew_failed',
  accessShared: 'drive.client_access.shared',
  accessShareFailed: 'drive.client_access.share_failed',
  accessRevoked: 'drive.client_access.revoked',
  accessRevokeFailed: 'drive.client_access.revoke_failed',
} as const satisfies Record<string, EventName>
