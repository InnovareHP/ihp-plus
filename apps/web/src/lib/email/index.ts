export { isEmailConfigured, sendEmail, type OutboundEmail } from './send'
export {
  contractAcceptedTemplate,
  contractPublishedTemplate,
  invitationTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
  type PreparedEmail,
} from './templates'
export { renderEmail, type EmailLayout } from './layout'
