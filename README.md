# ihp-plus

pnpm workspace monorepo: Astro marketing site + Next.js app behind one nginx origin.

## Layout

```
apps/
  web/        Next.js 16 (App Router, RSC) — mounted at /app via basePath, Mantine v9
  landing/    Astro 7 (static output) — mounted at /, Tailwind v4 + @ihp/ui
packages/
  ui/         shared React components, source-only TSX (@ihp/ui) — landing only
  config/     shared tsconfig presets + Tailwind v4 theme tokens (@ihp/config)
  db/         Prisma 7 client + Better Auth schema and migrations (@ihp/db)
infra/
  compose.yml       full containerized stack (postgres, redis, web, landing, proxy)
  compose.dev.yml   dev infra only (postgres, redis)
  docker/           Dockerfiles + nginx configs
```

Single origin means no CORS and shared cookies between landing and app.

| Path     | Served by                      |
| -------- | ------------------------------ |
| `/`      | Astro landing                  |
| `/app/*` | Next.js (incl. `_next`, `api`) |

## Prerequisites

Node >= 22.12, pnpm 10 (`corepack enable`), Docker Desktop.

## Dev (recommended on Windows)

Apps on the host, infra in Docker — bind-mounting `node_modules` into Linux
containers on Windows is slow and breaks native binaries.

```bash
cp .env.example .env   # then fill BETTER_AUTH_SECRET (>= 32 chars)
pnpm install
pnpm infra:up          # postgres + redis + minio (S3 for profile photos)
pnpm db:migrate        # creates the Better Auth tables
pnpm db:seed           # the org and its department teams
pnpm dev               # both apps via turbo
```

Redis only holds the sign-in rate limiter's counters and fails open without them, so
`pnpm infra:pg` plus `pnpm infra:s3` is enough for
day-to-day work — Postgres for everything, MinIO for the onboarding photo upload.
`pnpm infra:redis` starts Redis alone; `pnpm infra:pg:stop` /
`pnpm infra:redis:stop` / `pnpm infra:s3:stop` stop one without touching the others. Same compose file and
the same volumes either way — the scripts only pick which service comes up.

`.env` at the repo root is the only env file. Turbo 2 does not read `.env`, so the
root `dev`/`build`/`test` scripts go through `dotenv-cli` — they fail loudly if you
skipped the `cp` above.

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

| Script                | Does                                          |
| --------------------- | --------------------------------------------- |
| `pnpm build`          | turbo build both apps                         |
| `pnpm test`           | vitest (web)                                  |
| `pnpm lint`           | eslint (web)                                  |
| `pnpm typecheck`      | `tsc --noEmit` + `astro check`                |
| `pnpm format`         | prettier, incl. `.astro`                      |
| `pnpm db:auth-schema` | regenerate the Better Auth Prisma models      |
| `pnpm db:generate`    | create a migration without applying it        |
| `pnpm db:migrate`     | apply migrations to `DATABASE_URL`            |
| `pnpm db:seed`        | create the org + one team per department      |
| `pnpm rpc:generate`   | regenerate TS clients from the `.proto` files |
| `pnpm rpc:lint`       | `buf lint` the contract                       |
| `pnpm db:studio`      | prisma studio                                 |
| `pnpm infra:up`       | dev postgres + redis                          |
| `pnpm infra:pg`       | dev postgres only                             |
| `pnpm infra:redis`    | dev redis only                                |
| `pnpm infra:s3`       | dev minio + bucket creation                   |
| `pnpm stack:up`       | full docker stack                             |

## RPC

The contract lives in `packages/proto` (`ihp.<domain>.v1`, one service per file) and
`pnpm rpc:generate` writes TypeScript into `packages/rpc/src/gen`, which is **committed**
so installs and Docker builds need no codegen step. Never hand-edit it.

Connect v2 needs no `protoc-gen-connect-es`: `protoc-gen-es` v2 emits the service
descriptors that both `createClient()` and `createConnectRouter()` consume.

`@ihp/rpc` is the only place that depends on the Connect packages, and it exposes two
transports — `browserTransport` for client components, and `createRouterTransport` for
server components, which dispatches in-process with no network hop.

## Database schemas

Postgres multi-schema (GA in Prisma 7, no preview flag). `prisma/schema` is a folder,
not a file:

| File                             | Postgres schema | Owner                        |
| -------------------------------- | --------------- | ---------------------------- |
| `prisma/schema/auth.prisma`      | `auth`          | `pnpm db:auth-schema` output |
| `prisma/schema/<feature>.prisma` | `<feature>`     | you                          |

App models never go in `auth.prisma` — that file is regenerated. Each feature gets its
own file, its own `@@schema("<feature>")`, and its name added to the datasource's
`schemas` list, or the schema will not validate.

The generator's `output` is relative to the schema _file_, so it is `../../src/generated/prisma`
from inside `prisma/schema/`. A table that changes schema needs a hand-written
`ALTER TABLE ... SET SCHEMA` — `prisma migrate diff` emits `CREATE TABLE` in the new schema
and leaves the populated one behind.

## Conventions

- **Shared UI is source-only.** `@ihp/ui` exports raw `.tsx`; Astro compiles it via
  Vite. No build step, no `dist/`, no stale output.
- **`@ihp/db` is the one package with a build step.** `pnpm --filter @ihp/db build`
  runs `prisma generate` into `src/generated/`, which is gitignored — the output is
  coupled to the installed `@prisma/client`. Turbo sequences it via `^build`; the web
  Dockerfile runs it explicitly because `pnpm --filter` does not build dependencies.
- **One design system per app.** `apps/web` is Mantine v9 (`src/theme.ts`);
  `apps/landing` is Tailwind v4 + `@ihp/ui`. They are never mixed inside one app.
- **Tailwind v4 is CSS-first** and now only in `apps/landing`. Tokens live in
  `packages/config/tailwind/theme.css`, and the landing global CSS needs
  `@source '../../../../packages/ui/src'` so Tailwind scans the shared package.
  `apps/web/src/theme.ts` mirrors the same OKLCH ramp as Mantine shades.
- **Docker builds use the repo root as context** (`context: ..`) — the lockfile and
  workspace links live there. Dockerfiles copy every workspace `package.json` before
  the source so `pnpm install` stays cached.
- **Next uses `output: 'standalone'`** with `outputFileTracingRoot` set to the repo
  root; the runtime image carries only traced files, not `node_modules`.
- Adding a workspace package? Add its `package.json` to the `COPY` list in both
  Dockerfiles.

## Auth

Better Auth on the Prisma adapter, mounted at `/app/api/auth/*`. Email + password
and Microsoft Entra ID ("Continue with Outlook") are both enabled.

Routes in `apps/web/src/app` use route groups, which do not appear in the URL:

| Folder          | URLs                                                       | Session                      |
| --------------- | ---------------------------------------------------------- | ---------------------------- |
| `(auth)/`       | `/login`, `/signup`, `/forgot-password`, `/reset-password` | none                         |
| `(onboarding)/` | `/onboarding`                                              | required, profile unfinished |
| `(dashboard)/`  | `/`, `/settings`                                           | required, profile finished   |

`src/lib/routes.ts` is the single source for those paths. `src/proxy.ts` (Next 16's
rename of middleware) does a cookie-only optimistic redirect; `requireSession()`
revalidates against the database in every protected layout.

Feature code lives under `src/features/<feature>/` — schemas, messages, and
components together. `src/lib` holds the auth instance, client, guard, and query
client; `src/components` holds app chrome (providers, shell, skip link).

### Outlook sign-in setup

Register a Web app in [Microsoft Entra](https://entra.microsoft.com), then set
`MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` in `.env` and add the redirect URI
for the environment you are running:

```
http://localhost:3000/app/api/auth/callback/microsoft   # host dev
http://localhost/app/api/auth/callback/microsoft        # full stack via the proxy
```

`MICROSOFT_TENANT_ID=common` accepts work/school Entra accounts and personal
Outlook.com accounts.

## Not yet wired

No transactional email provider: password-reset and verification links are written
to the server log instead of sent. Redis holds only the sign-in rate limiter's
counters.
