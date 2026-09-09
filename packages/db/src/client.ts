import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

// Next's dev server re-evaluates this module on every edit, so the client is cached.
const globalForDb = globalThis as unknown as { ihpPrisma?: PrismaClient }

// No throw on a missing DATABASE_URL: the Docker build stage has no env and must still compile.
function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
  })
}

export const db = globalForDb.ihpPrisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.ihpPrisma = db
}

export type Db = typeof db
