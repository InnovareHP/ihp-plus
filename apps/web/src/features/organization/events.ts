import type { EventName } from '@/lib/analytics'

export const organizationEvents = {
  profileUpdated: 'organization.profile.updated',
  profileUpdateFailed: 'organization.profile.update_failed',
  teamCreated: 'organization.team.created',
  teamCreateFailed: 'organization.team.create_failed',
  teamRenamed: 'organization.team.renamed',
  teamRenameFailed: 'organization.team.rename_failed',
  teamDeleted: 'organization.team.deleted',
  teamDeleteFailed: 'organization.team.delete_failed',
  departmentAssigned: 'organization.team.member_assigned',
  departmentAssignFailed: 'organization.team.member_assign_failed',
  departmentCleared: 'organization.team.member_removed',
  departmentClearFailed: 'organization.team.member_remove_failed',
  invitationSent: 'organization.invitation.sent',
  invitationSendFailed: 'organization.invitation.send_failed',
  invitationCanceled: 'organization.invitation.canceled',
  invitationCancelFailed: 'organization.invitation.cancel_failed',
  invitationResent: 'organization.invitation.resent',
  invitationResendFailed: 'organization.invitation.resend_failed',
  invitationAccepted: 'organization.invitation.accepted',
  invitationAcceptFailed: 'organization.invitation.accept_failed',
} as const satisfies Record<string, EventName>
