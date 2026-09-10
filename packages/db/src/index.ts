export { db } from './client'
export type { Db } from './client'

// Query input types (where, orderBy) so callers can build a filter object outside a call site.
export { Prisma } from './generated/prisma/client'

// Prisma 7 names the row types <Model>Model; re-exported here so consumers say User, not UserModel.
export type {
  AccountModel as Account,
  InvitationModel as Invitation,
  MemberModel as Member,
  OrganizationModel as Organization,
  SessionModel as Session,
  TeamMemberModel as TeamMember,
  TeamModel as Team,
  UserModel as User,
  VerificationModel as Verification,
} from './generated/prisma/models'
