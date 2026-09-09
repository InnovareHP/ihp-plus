import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// The repo root .env is the single env file for every workspace.
config({ path: '../../.env' })

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
})
