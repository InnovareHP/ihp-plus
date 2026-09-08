# syntax=docker/dockerfile:1.7
# Build context MUST be the repo root.
#   docker build -f infra/docker/landing.Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm --filter @ihp/landing build

# ---- runner: static files on nginx, no Node at runtime ----
FROM nginx:1.29-alpine AS runner
COPY infra/docker/nginx/landing.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/landing/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
