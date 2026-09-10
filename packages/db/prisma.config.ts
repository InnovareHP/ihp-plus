import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// The repo root .env is the single env file for every workspace.
config({ path: '../../.env' })

export default defineConfig({
  // A folder, not a file: auth.prisma is CLI output, each feature adds its own file.
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
