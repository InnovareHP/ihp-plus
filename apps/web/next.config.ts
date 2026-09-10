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
  transpilePackages: ['@ihp/db', '@ihp/rpc'],

  // The pg driver opens real sockets; bundling it breaks the standalone server.
  serverExternalPackages: ['@prisma/adapter-pg', 'pg'],

  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
