export { db } from './client'
export type { Db } from './client'

// Prisma 7 names the row types <Model>Model; re-exported here so consumers say User, not UserModel.
export type {
  AccountModel as Account,
  SessionModel as Session,
  UserModel as User,
  VerificationModel as Verification,
} from './generated/prisma/models'
