# Stack lookup table

Copied from the repo on 2026-09-10. If any value here disagrees with the file it
came from, the file wins — fix this table.

## Commands (root `package.json`)

| Script                                          | Runs                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`                                      | `turbo run dev` (both apps, persistent, uncached)                                 |
| `pnpm dev:web`                                  | `turbo run dev --filter=@ihp/web`                                                 |
| `pnpm dev:landing`                              | `turbo run dev --filter=@ihp/landing`                                             |
| `pnpm build`                                    | `turbo run build`                                                                 |
| `pnpm test`                                     | `turbo run test` — `@ihp/web` and `@ihp/graph` define it (`vitest run`)           |
| `pnpm lint`                                     | `turbo run lint` — only `@ihp/web` defines it                                     |
| `pnpm typecheck`                                | `tsc --noEmit` (web, ui, db) + `astro check` (landing)                            |
| `pnpm format`                                   | prettier write, incl. `.astro` — repo-wide, rewrites unrelated files              |
| `pnpm db:generate` / `db:migrate` / `db:studio` | `prisma` in `@ihp/db` (`migrate dev --create-only` / `migrate deploy` / `studio`) |
| `pnpm db:auth-schema`                           | regenerates the Better Auth models in `prisma/schema.prisma`                      |
| `pnpm clean`                                    | per-package clean + removes root `node_modules`                                   |
| `pnpm infra:up` / `infra:down`                  | `infra/compose.dev.yml`, both services                                            |
| `pnpm infra:pg` / `infra:pg:stop`               | same file, `postgres` only (additive)                                             |
| `pnpm infra:redis` / `infra:redis:stop`         | same file, `redis` only (additive)                                                |
| `pnpm stack:up` / `stack:down`                  | `infra/compose.yml` (`up --build`)                                                |

Both compose scripts pass `--env-file .env`. `dev`, `dev:web`, `dev:landing`,
`build`, and `test` are prefixed with `dotenv -e .env --`: turbo 2 does not read
`.env` files, so without it nothing on the host sees `DATABASE_URL` or
`BETTER_AUTH_SECRET`. They fail hard if `.env` is missing.

## Workspaces

| Package        | Path              | Notes                                                                                                                                          |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ihp/web`     | `apps/web`        | Next 16.3.4, React 19.2.8, `basePath: '/app'`, `output: 'standalone'`, Mantine 9.6.1, Better Auth 1.7.3                                        |
| `@ihp/landing` | `apps/landing`    | Astro ^7.3.1, `output: 'static'`, `@astrojs/react`, Tailwind v4 + `@ihp/ui`                                                                    |
| `@ihp/ui`      | `packages/ui`     | source-only TSX, `Button` + `Card`, no build step — consumed by landing only                                                                   |
| `@ihp/config`  | `packages/config` | `tsconfig/base.json`, `tsconfig/nextjs.json`, `tailwind/theme.css`                                                                             |
| `@ihp/db`      | `packages/db`     | Prisma 7.10 + `@prisma/adapter-pg`, `prisma/schema.prisma`, `prisma/migrations/`; client generated into `src/generated/` by its `build` script |

Built deps allowed in `pnpm-workspace.yaml`: `@prisma/engines`, `@tailwindcss/oxide`,
`esbuild`, `prisma`, `sharp`, `unrs-resolver`.

## Ports and URLs

| What               | Value                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| Next dev           | `http://localhost:3000/app`                                                      |
| Astro dev          | `http://localhost:4321`                                                          |
| Full stack entry   | `http://localhost:${PROXY_PORT}` (default 80)                                    |
| Health route       | `/app/api/health` → `{ status, service: 'web', ts }`                             |
| Auth routes        | `/app/api/auth/*` (Better Auth `basePath: '/app/api/auth'`)                      |
| Entra redirect URI | `${BETTER_AUTH_URL}/app/api/auth/callback/microsoft`                             |
| Sign-in page       | `/app/login` — also `/app/signup`, `/app/forgot-password`, `/app/reset-password` |
| Dashboard          | `/app` and `/app/settings`, both session-gated                                   |
| Postgres (dev)     | `localhost:${POSTGRES_PORT}` default 5432                                        |
| Redis (dev)        | `localhost:${REDIS_PORT}` default 6379                                           |

## Containers

| Service    | Image / build                                                                                   | Exposed            |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------ |
| `postgres` | `postgres:17-alpine`, `pg_isready` healthcheck                                                  | 5432 (dev only)    |
| `redis`    | `redis:7-alpine`, `--appendonly yes`                                                            | 6379 (dev only)    |
| `web`      | `infra/docker/web.Dockerfile`, node:22-alpine, uid 1001 `nextjs`, `CMD node apps/web/server.js` | 3000 (internal)    |
| `landing`  | `infra/docker/landing.Dockerfile`, `nginx:1.29-alpine` serving `dist/`                          | 80 (internal)      |
| `proxy`    | `nginx:1.29-alpine`, mounts `docker/nginx/proxy.conf`                                           | `${PROXY_PORT}:80` |

Compose project names: `ihp-plus` (full), `ihp-plus-dev` (dev) — separate volumes
(`postgres-data`/`redis-data` vs `postgres-dev-data`/`redis-dev-data`).

## Proxy routes (`infra/docker/nginx/proxy.conf`)

| Location | Upstream                                         |
| -------- | ------------------------------------------------ |
| `/app`   | `web:3000` (covers `/app/_next/*`, `/app/api/*`) |
| `/`      | `landing:80`                                     |

`client_max_body_size 25m`; websocket upgrade mapped for HMR.
`landing.conf` caches `/_astro/` immutable for 1y and does
`try_files $uri $uri/index.html $uri/ =404`.

## Env vars (`.env.example`)

`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `REDIS_PORT`,
`DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_SITE_URL`, `PROXY_PORT`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `MICROSOFT_CLIENT_ID`,
`MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`, `EMAIL_FROM`.

`BETTER_AUTH_URL` is the origin the **browser** hits: `http://localhost:3000` for host
dev, `http://localhost` behind the proxy. `infra/compose.yml` requires
`BETTER_AUTH_SECRET` and fails the `web` service without it.

Host dev uses `localhost`; inside compose use service names `postgres` / `redis`
(`infra/compose.yml` sets those for `web` directly). `turbo.json` declares
`DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_*`, `BETTER_AUTH_URL`,
`BETTER_AUTH_SECRET`, and `MICROSOFT_*` for `build`, and `.env` as a global
dependency.

## No CI

There is no `.github/`, no pipeline, and no deploy target as of 2026-09-10.
Deployment is manual `docker compose` for now — do not reference a pipeline that
does not exist.

Tests do exist: Vitest 5 + Testing Library + `vitest-axe` in `@ihp/web`
(`apps/web/vitest.config.ts`, jsdom, setup at `src/test/setup.ts`), a `test` task in
`turbo.json`, and `pnpm test` at the root. `@ihp/graph` has its own runner too
(`packages/graph/vitest.config.ts`, node environment, no setup file); no other
workspace does.

There is no email provider: password-reset and verification links are logged by
`apps/web/src/lib/email.ts`, not sent. Nothing reads `REDIS_URL`.
