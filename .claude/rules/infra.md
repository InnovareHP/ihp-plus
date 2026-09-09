# Infra

Two compose files, two Dockerfiles, one nginx proxy. Know which one you are in.

## Which stack

| Command | Runs | Use when |
| --- | --- | --- |
| `pnpm infra:up` | `infra/compose.dev.yml` — postgres + redis, ports published | normal development; apps run on the host via `pnpm dev` |
| `pnpm infra:pg` | the same file, postgres only | the usual case — nothing reads `REDIS_URL` yet |
| `pnpm infra:redis` | the same file, redis only | working on something that needs Redis and not the DB |
| `pnpm stack:up` | `infra/compose.yml` — postgres, redis, web, landing, proxy, built from source | verifying the production shape, Dockerfiles, or nginx routing |

The per-service scripts are **additive, not exclusive**: `up -d <service>` starts
what is named and leaves everything else alone, so `infra:pg` followed by
`infra:redis` ends up identical to `infra:up`, in either order and at any time. Same
compose file, same project name, same volumes — the scripts only choose which
containers come up. `infra:pg:stop` / `infra:redis:stop` stop one service without
touching the other; `infra:down` removes both containers (volumes survive — never
add `-v`).

Project names differ (`ihp-plus-dev` vs `ihp-plus`), so the two stacks have
**separate volumes** — data written in dev is not visible in the full stack.

Apps stay on the host in dev deliberately: bind-mounting `node_modules` into Linux
containers on Windows is slow and breaks native binaries (`@tailwindcss/oxide`,
`sharp`, `esbuild` are the built deps in `pnpm-workspace.yaml`).

## Docker build context is the repo root

Both Dockerfiles declare `context: ..` and require it: `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, and the workspace links live at the root. Manual build is
`docker build -f infra/docker/web.Dockerfile .` from the repo root — never from
`infra/`.

Layer order is deliberate: every workspace `package.json` is copied *before* the
source so the `pnpm install --frozen-lockfile` layer stays cached. Do not collapse
that into a single `COPY . .`.

`--frozen-lockfile` means a `package.json` change without a matching
`pnpm-lock.yaml` commit fails the image build. Run `pnpm install` on the host and
include the lockfile in the same change.

## The two runtime images

- **web**: Node 22 alpine, `output: 'standalone'` with
  `outputFileTracingRoot` = repo root, so the bundle mirrors the monorepo layout and
  the entrypoint is `node apps/web/server.js`. Static assets and `public/` are
  copied in separately — standalone does not include them. Runs as uid 1001
  `nextjs`. Healthcheck hits `/app/api/health` (basePath included).
- **landing**: built with `pnpm --filter @ihp/landing build`, then `dist/` served by
  `nginx:1.29-alpine` — **no Node at runtime**. Config is
  `infra/docker/nginx/landing.conf`.

Changing the health route path, the basePath, or the standalone output means
updating the Dockerfile HEALTHCHECK too.

## Proxy routing

`infra/docker/nginx/proxy.conf` is the single origin: `location /app` →
`web:3000`, `location /` → `landing:80`. `/app` covers `_next` and `api` because
Next's `basePath` puts them there. Websocket upgrade is mapped for HMR.
`client_max_body_size 25m`.

Single origin is why there is no CORS config anywhere and why cookies are shared
between landing and app. A change that splits the origins breaks both properties —
flag it rather than doing it silently.

`landing.conf` caches `/_astro/` for a year (content-hashed) and does
`try_files $uri $uri/index.html` for Astro's directory-format output.

## Data

Postgres 17, Redis 7 with AOF on. Volumes: `postgres-data`/`redis-data` (full
stack), `postgres-dev-data`/`redis-dev-data` (dev). Both compose files gate `web`
on `service_healthy` for postgres and redis.

Postgres is reached through `@ihp/db`: Drizzle ORM + `node-postgres`, one pooled
client cached on `globalThis` so Next's dev reloads do not leak pools. Migrations
are SQL files in `packages/db/migrations`, generated with `pnpm db:generate` and
applied with `pnpm db:migrate`. Nothing reads `REDIS_URL` yet — propose a client
before assuming one.

Turbo 2 does not read `.env` files, so the root `dev`/`build`/`test` scripts run
through `dotenv-cli` to load the repo-root `.env`. Inside compose, env comes from
the service definitions instead.

Destructive commands are blocked by `.claude/hooks/validate-bash.sh`: volume
removal, prunes, `DROP`/`TRUNCATE`, `git push`. If one is genuinely needed, say so
and let the user run it.
