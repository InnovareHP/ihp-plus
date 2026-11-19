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
COPY packages/email/package.json packages/email/
COPY packages/clock/package.json packages/clock/
# No pnpm cache mount: Railway rejects one whose id is not prefixed with its service id.
RUN pnpm install --frozen-lockfile

# ---- builder ----
FROM deps AS builder
COPY . .
# Baked into the client bundle; Railway and compose only pass build-time values declared here.
ARG NEXT_PUBLIC_POSTHOG_KEY NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_TELEMETRY_DISABLED=1
# Build-only placeholders: prisma generate never connects, and Better Auth refuses to import
# without a secret; neither reaches the runtime image, which gets the real values.
RUN DATABASE_URL=postgresql://build@localhost/build pnpm --filter @ihp/db build && \
    BETTER_AUTH_SECRET=build-only-placeholder-never-used-at-runtime pnpm --filter @ihp/web build

# ---- runner: only the standalone bundle ----
FROM base AS runner
# @sparticuz/chromium is a glibc build that cannot run on alpine, so website snapshots use this one.
RUN apk add --no-cache chromium font-noto
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    SNAPSHOT_CHROME_PATH=/usr/bin/chromium-browser
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
