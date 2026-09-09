# Stack lookup table

Copied from the repo on 2026-09-09. If any value here disagrees with the file it
came from, the file wins — fix this table.

## Commands (root `package.json`)

| Script | Runs |
| --- | --- |
| `pnpm dev` | `turbo run dev` (both apps, persistent, uncached) |
| `pnpm dev:web` | `turbo run dev --filter=@ihp/web` |
| `pnpm dev:landing` | `turbo run dev --filter=@ihp/landing` |
| `pnpm build` | `turbo run build` |
| `pnpm lint` | `turbo run lint` — only `@ihp/web` defines it |
| `pnpm typecheck` | `tsc --noEmit` (web, ui) + `astro check` (landing) |
| `pnpm format` | prettier write, incl. `.astro` |
| `pnpm clean` | per-package clean + removes root `node_modules` |
| `pnpm infra:up` / `infra:down` | `infra/compose.dev.yml` |
| `pnpm stack:up` / `stack:down` | `infra/compose.yml` (`up --build`) |

Both compose scripts pass `--env-file .env`.

## Workspaces

| Package | Path | Notes |
| --- | --- | --- |
| `@ihp/web` | `apps/web` | Next 16.3.4, React 19.2.8, `basePath: '/app'`, `output: 'standalone'` |
| `@ihp/landing` | `apps/landing` | Astro ^7.3.1, `output: 'static'`, `@astrojs/react` |
| `@ihp/ui` | `packages/ui` | source-only TSX, `Button` + `Card`, no build step |
| `@ihp/config` | `packages/config` | `tsconfig/base.json`, `tsconfig/nextjs.json`, `tailwind/theme.css` |

Built deps allowed in `pnpm-workspace.yaml`: `@tailwindcss/oxide`, `esbuild`,
`sharp`, `unrs-resolver`.

## Ports and URLs

| What | Value |
| --- | --- |
| Next dev | `http://localhost:3000/app` |
| Astro dev | `http://localhost:4321` |
| Full stack entry | `http://localhost:${PROXY_PORT}` (default 80) |
| Health route | `/app/api/health` → `{ status, service: 'web', ts }` |
| Postgres (dev) | `localhost:${POSTGRES_PORT}` default 5432 |
| Redis (dev) | `localhost:${REDIS_PORT}` default 6379 |

## Containers

| Service | Image / build | Exposed |
| --- | --- | --- |
| `postgres` | `postgres:17-alpine`, `pg_isready` healthcheck | 5432 (dev only) |
| `redis` | `redis:7-alpine`, `--appendonly yes` | 6379 (dev only) |
| `web` | `infra/docker/web.Dockerfile`, node:22-alpine, uid 1001 `nextjs`, `CMD node apps/web/server.js` | 3000 (internal) |
| `landing` | `infra/docker/landing.Dockerfile`, `nginx:1.29-alpine` serving `dist/` | 80 (internal) |
| `proxy` | `nginx:1.29-alpine`, mounts `docker/nginx/proxy.conf` | `${PROXY_PORT}:80` |

Compose project names: `ihp-plus` (full), `ihp-plus-dev` (dev) — separate volumes
(`postgres-data`/`redis-data` vs `postgres-dev-data`/`redis-dev-data`).

## Proxy routes (`infra/docker/nginx/proxy.conf`)

| Location | Upstream |
| --- | --- |
| `/app` | `web:3000` (covers `/app/_next/*`, `/app/api/*`) |
| `/` | `landing:80` |

`client_max_body_size 25m`; websocket upgrade mapped for HMR.
`landing.conf` caches `/_astro/` immutable for 1y and does
`try_files $uri $uri/index.html $uri/ =404`.

## Env vars (`.env.example`)

`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `REDIS_PORT`,
`DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_SITE_URL`, `PROXY_PORT`.

Host dev uses `localhost`; inside compose use service names `postgres` / `redis`
(`infra/compose.yml` sets those for `web` directly). `turbo.json` declares
`DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_*` for `build`, and `.env` as a global
dependency.

## No CI

There is no `.github/`, no pipeline, and no deploy target as of 2026-09-10.
Deployment is manual `docker compose` for now — do not reference a pipeline that
does not exist.

No test runner is installed yet either, though tests are required for every major
feature (`.claude/rules/testing.md`): the first tested feature adds Vitest +
Testing Library, a `test` task in `turbo.json`, and a root `pnpm test` — update
this table then.
