export { db } from './client'
export type { Db } from './client'

// Query input types (where, orderBy) so callers can build a filter object outside a call site.
export { Prisma } from './generated/prisma/client'

// Prisma 7 names the row types <Model>Model; re-exported here so consumers say User, not UserModel.
export type {
  AccountModel as Account,
  BluebookDocumentModel as BluebookDocument,
  ClientModel as Client,
  InvitationModel as Invitation,
  LookupOptionModel as LookupOption,
  MemberModel as Member,
  OrganizationModel as Organization,
  RequestApproverModel as RequestApprover,
  RequestFormModel as RequestForm,
  RequestFormTeamModel as RequestFormTeam,
  RequestSubmissionModel as RequestSubmission,
  SessionModel as Session,
  StripeEventModel as StripeEvent,
  StripeInvoiceModel as StripeInvoice,
  TeamLeadModel as TeamLead,
  TeamMemberModel as TeamMember,
  TeamModel as Team,
  UserModel as User,
  VerificationModel as Verification,
} from './generated/prisma/models'
