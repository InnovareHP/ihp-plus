import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'
import { routes, withBasePath } from './src/lib/routes'

// Repo root — standalone output must trace files outside apps/web (pnpm workspace links).
const monorepoRoot = fileURLToPath(new URL('../../', import.meta.url))

const nextConfig: NextConfig = {
  // Slim Docker image: emits apps/web/.next/standalone with only used deps. Vercel builds its
  // own output and never writes the trace manifest the standalone step then reads
  // (ENOENT next-server.js.nft.json), so that platform gets an ordinary build.
  // VERCEL is declared in turbo.json; strict env mode would otherwise hide it here.
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),
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

  // Nothing is served outside basePath, so the bare origin root 404s; send it to sign-in.
  async redirects() {
    return [
      { source: '/', destination: withBasePath(routes.login), basePath: false, permanent: false },
    ]
  },

  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
