---
name: stack
description: Running, building, and debugging this repo's local environment — pnpm dev, the docker infra stack, the full containerized stack, nginx routing at /app, health checks, and image build failures. Use when asked to start or stop the app, bring up postgres/redis, build or debug the Docker images, reproduce the production shape, or when a request fails with a 404, 502, or a broken asset.
---

# Running the ihp-plus stack

Names, ports, and paths are in `stack-config.md`. Read it before guessing.

## Pick the right mode

**Host dev (default).** Apps on the host, infra in Docker:

```bash
pnpm infra:up      # postgres + redis, ports published
pnpm dev           # turbo runs both apps
```

Single service: `pnpm infra:pg` (Postgres alone — the usual case, nothing reads
`REDIS_URL` yet) or `pnpm infra:redis`. They are additive, so running both equals
`infra:up`; `pnpm infra:pg:stop` / `pnpm infra:redis:stop` stop one without
touching the other.

Web is at `http://localhost:3000/app` — **not** `:3000`, the `basePath` is `/app`,
so bare `/` returns a 404 by design. Landing is `http://localhost:4321`.
Single app: `pnpm dev:web` / `pnpm dev:landing`.

First run needs `cp .env.example .env` and `pnpm install` (Node >= 22.12,
`corepack enable` for pnpm 10).

**Full stack.** Everything containerized behind nginx on one origin:

```bash
pnpm stack:up      # builds images, http://localhost (PROXY_PORT)
pnpm stack:down
```

Use it to verify Dockerfiles, nginx routing, standalone output, or anything that
depends on the single-origin property. It rebuilds images every time — slower.

Never add `-v` to a `down`, and do not prune volumes: that deletes the local
Postgres data. The Bash hook blocks these.

## Troubleshooting

**404 in host dev at `/`** — expected. Next serves under `/app`.

**502 from the proxy** — `web` or `landing` is unhealthy. `docker compose -f
infra/compose.yml ps` shows health; `docker compose -f infra/compose.yml logs web`
for the reason. `web` only starts after postgres and redis report healthy.

**Health check failing** — the container check hits `/app/api/health` (basePath
included). If the route or basePath moved, the HEALTHCHECK in
`infra/docker/web.Dockerfile` needs the same change.

**`ERR_PNPM_OUTDATED_LOCKFILE` during image build** — a `package.json` changed
without `pnpm-lock.yaml`. Run `pnpm install` on the host and rebuild.

**Image build fails resolving a workspace package** — its `package.json` is missing
from the deps-stage COPY list in the Dockerfile. Both Dockerfiles have their own
list; add it to both.

**Docker build "file not found"** — the build was run from `infra/`. The context
must be the repo root: `docker build -f infra/docker/web.Dockerfile .`

**Shared-UI styles missing but classes present in the DOM** — the `@source` line in
that app's global CSS is missing or has the wrong relative depth, so Tailwind never
scanned `packages/ui/src`.

**Stale build output after an env change** — turbo cached it. Build-time vars must
be in `turbo.json` `env`; `.env` is a `globalDependency`, so editing it invalidates
the cache, but a var read at build time and not declared will still be baked in.

**`password authentication failed for user "ihp"` (28P01)** — usually not the
password. A native Postgres service on the host (`postgresql-x64-18` was found on
this machine, bound to `0.0.0.0:5432` and `[::]:5432`) also owns 5432; Windows
allows the duplicate bind, so compose reports the mapping while `localhost:5432`
actually reaches the native server, which has no `ihp` role. Diagnose in this
order:

1. `Get-NetTCPConnection -LocalPort 5432 -State Listen` → owning process. A
   `postgres.exe` that is not Docker means the port is shadowed.
2. Test the container over the docker network, which bypasses the host port and
   uses the real scram path:
   `docker run --rm --network ihp-plus-dev_default -e PGPASSWORD=<pw> postgres:17-alpine psql -h postgres -U ihp -d ihp_plus -c 'select 1'`
   Success here proves the credentials and the volume are fine.
3. Do **not** test with `docker compose exec ... psql -h 127.0.0.1`: the image's
   `host all all 127.0.0.1/32 trust` line accepts any password, so it passes even
   when the real path fails.

Fix by moving the container off the contested port — `POSTGRES_PORT=55432` **and**
the port inside `DATABASE_URL` (nothing derives one from the other), then
`pnpm infra:pg`. Data survives; only the published port changes. Stopping the
native service is the alternative and needs an elevated shell.

**Port already in use** — report which port and which process. Do not silently
change 3000/4321/`PROXY_PORT`; the values are duplicated across compose files,
nginx, and the README. `POSTGRES_PORT`/`REDIS_PORT` are the exception — they exist
to be moved when a host service already owns the port.

**Dev data missing from the full stack** — different compose project names mean
different volumes (`ihp-plus-dev` vs `ihp-plus`). This is expected, not a bug.

## Not wired yet

Postgres and Redis run, but no client, ORM, migrations, or `packages/db` exist. A
task that needs persistence starts with choosing Drizzle or Prisma — ask, do not
pick one unilaterally.
