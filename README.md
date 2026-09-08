# ihp-plus

pnpm workspace monorepo: Astro marketing site + Next.js app behind one nginx origin.

## Layout

```
apps/
  web/        Next.js 16 (App Router, RSC) — mounted at /app via basePath
  landing/    Astro 7 (static output) — mounted at /
packages/
  ui/         shared React components, source-only TSX (@ihp/ui)
  config/     shared tsconfig presets + Tailwind v4 theme tokens (@ihp/config)
infra/
  compose.yml       full containerized stack (postgres, redis, web, landing, proxy)
  compose.dev.yml   dev infra only (postgres, redis)
  docker/           Dockerfiles + nginx configs
```

Single origin means no CORS and shared cookies between landing and app.

| Path      | Served by            |
| --------- | -------------------- |
| `/`       | Astro landing        |
| `/app/*`  | Next.js (incl. `_next`, `api`) |

## Prerequisites

Node >= 22.12, pnpm 10 (`corepack enable`), Docker Desktop.

## Dev (recommended on Windows)

Apps on the host, infra in Docker — bind-mounting `node_modules` into Linux
containers on Windows is slow and breaks native binaries.

```bash
cp .env.example .env
pnpm install
pnpm infra:up          # postgres + redis
pnpm dev               # both apps via turbo
```

- app: http://localhost:3000/app
- landing: http://localhost:4321

Single app: `pnpm dev:web` / `pnpm dev:landing`.

## Full container stack

```bash
pnpm stack:up          # builds images, serves everything on http://localhost
pnpm stack:down
```

Change the entry port with `PROXY_PORT` in `.env`.

## Scripts

| Script           | Does                                  |
| ---------------- | ------------------------------------- |
| `pnpm build`     | turbo build both apps                 |
| `pnpm lint`      | eslint (web)                          |
| `pnpm typecheck` | `tsc --noEmit` + `astro check`        |
| `pnpm format`    | prettier, incl. `.astro`              |
| `pnpm infra:up`  | dev postgres + redis                  |
| `pnpm stack:up`  | full docker stack                     |

## Conventions

- **Shared UI is source-only.** `@ihp/ui` exports raw `.tsx`; Next compiles it via
  `transpilePackages`, Astro via Vite. No build step, no `dist/`, no stale output.
- **Tailwind v4 is CSS-first.** Tokens live in `packages/config/tailwind/theme.css`,
  imported by each app's global CSS. Each app also needs
  `@source '../../../../packages/ui/src'` so Tailwind scans the shared package.
- **Docker builds use the repo root as context** (`context: ..`) — the lockfile and
  workspace links live there. Dockerfiles copy every workspace `package.json` before
  the source so `pnpm install` stays cached.
- **Next uses `output: 'standalone'`** with `outputFileTracingRoot` set to the repo
  root; the runtime image carries only traced files, not `node_modules`.
- Adding a workspace package? Add its `package.json` to the `COPY` list in both
  Dockerfiles.

## Not yet wired

Postgres and Redis run but no client is installed — pick an ORM (Drizzle/Prisma) and
add it as `packages/db`, then read `DATABASE_URL` / `REDIS_URL` from the env.
