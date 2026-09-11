import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

// A side-effect module, imported before ../src/client so DATABASE_URL is set before Prisma
// reads it: import statements are evaluated in order, but all of them run before any top-level
// statement, so calling config() inside seed.ts would come too late.
//
// The root `pnpm db:seed` wraps this in dotenv-cli. Running `pnpm --filter @ihp/db db:seed`
// does not, and an empty connection string fails as ECONNREFUSED against localhost:5432
// rather than saying what is actually missing.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env at the repo root, then run pnpm db:seed.',
  )
}
