export { isEmailConfigured, sendEmail, type OutboundEmail } from './send'
export {
  clientFolderSharedTemplate,
  contractAcceptedTemplate,
  contractPublishedTemplate,
  evaluationAssignedTemplate,
  invitationTemplate,
  requestDecidedTemplate,
  requestSubmittedTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
  type PreparedEmail,
} from './templates'
export { renderEmail, type EmailLayout } from './layout'
export { portalUrl } from './portal-url'
