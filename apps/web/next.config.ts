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

  // @ihp/ui ships raw TSX, so Next must compile it.
  transpilePackages: ['@ihp/ui'],

  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
