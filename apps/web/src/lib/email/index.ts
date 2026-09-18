export { isEmailConfigured, sendEmail, type OutboundEmail } from './send'
export {
  clientFolderSharedTemplate,
  clientOwnerAssignedTemplate,
  contractAcceptedTemplate,
  contractPublishedTemplate,
  contractStatusChangedTemplate,
  evaluationAssignedTemplate,
  evaluationCancelledTemplate,
  evaluationSubmittedTemplate,
  invitationTemplate,
  memberAccessChangedTemplate,
  memberJoinedTemplate,
  memberRoleChangedTemplate,
  requestDecidedTemplate,
  requestReceivedTemplate,
  requestSubmittedTemplate,
  requestWithdrawnTemplate,
  resetPasswordTemplate,
  taskCommentTemplate,
  taskMentionTemplate,
  verifyEmailTemplate,
  type PreparedEmail,
} from './templates'
export { renderEmail, type EmailLayout } from './layout'
export { portalUrl } from './portal-url'
