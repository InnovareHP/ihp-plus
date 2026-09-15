import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

// Repo root — standalone output must trace files outside apps/web (pnpm workspace links).
const monorepoRoot = fileURLToPath(new URL('../../', import.meta.url))

const nextConfig: NextConfig = {
  // Slim Docker image: emits apps/web/.next/standalone with only used deps.
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,

  // Astro owns "/", Next is mounted under "/app" by the nginx proxy.
  basePath: '/app',

  // Both ship raw TS — Prisma's generated client and buf's generated messages — so Next
  // has to compile them rather than consume a build output.
  transpilePackages: ['@ihp/db', '@ihp/rpc', '@ihp/graph'],

  // The pg driver and the Redis client open real sockets; bundling them breaks the standalone server.
  serverExternalPackages: ['@prisma/adapter-pg', 'pg', 'redis', '@redis/client'],

  // Bluebook uploads travel through a server action, whose body cap is 1MB by default; nginx
  // allows 25m, so the two limits are kept in step.
  experimental: { serverActions: { bodySizeLimit: '25mb' } },

  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
