# syntax=docker/dockerfile:1.7
# Build context MUST be the repo root: pnpm-lock.yaml and the workspace links live there.
#   docker build -f infra/docker/web.Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- deps: cached until a package.json or the lockfile changes ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
COPY packages/ui/package.json packages/ui/
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
COPY packages/proto/package.json packages/proto/
COPY packages/rpc/package.json packages/rpc/
COPY packages/graph/package.json packages/graph/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ---- builder ----
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @ihp/db build && pnpm --filter @ihp/web build

# ---- runner: only the standalone bundle ----
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# standalone mirrors the monorepo layout, so server.js lands in apps/web/
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/app/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
