import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema/index'

// Next's dev server re-evaluates this module on every edit, so the pool is cached.
const globalForDb = globalThis as unknown as { ihpPool?: Pool }

// No throw on a missing DATABASE_URL: the Docker build stage has no env and must still compile.
const pool =
  globalForDb.ihpPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.ihpPool = pool
}

export const db = drizzle(pool, { schema })
export { pool }
export type Db = typeof db
