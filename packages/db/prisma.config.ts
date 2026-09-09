import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// The repo root .env is the single env file for every workspace.
config({ path: '../../.env' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
