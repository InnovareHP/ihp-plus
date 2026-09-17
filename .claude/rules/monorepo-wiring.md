# Monorepo wiring

The parts of this repo that break silently. Every item is a real coupling in the
current tree, not general advice.

## Shared UI is source-only

`@ihp/ui` exports raw `.tsx` (`exports: { ".": "./src/index.ts", "./*": "./src/*.tsx" }`).
There is no build step and no `dist/`. Consumers compile it:

- Astro: Vite compiles it as workspace source, no config needed.
- Next does **not** consume `@ihp/ui` any more — `apps/web` is Mantine and lists
  `transpilePackages: ['@ihp/db']` instead. `pg` is in `serverExternalPackages`
  because bundling it breaks the standalone server's sockets.

Do not add a build script, `tsup`, or a `main`/`dist` field to `packages/ui`.

## Tailwind must be told to scan the shared package

Tailwind v4 only scans the app it is rooted in, and only `apps/landing` uses
Tailwind now, so exactly one file carries:

```css
@source '../../../../packages/ui/src';
```

`apps/landing/src/styles/global.css`. A class used only inside `@ihp/ui` gets dropped
from the CSS if that line is missing or the relative depth is wrong. A moved global
CSS file → fix the `@source` path and check a `brand-*` class actually renders.
`apps/web/src/app/globals.css` imports Mantine's stylesheets instead and has no
`@source` line.

## Adding a workspace package: the wiring checklist

`pnpm-workspace.yaml` globs `apps/*` and `packages/*`, so the folder is picked up
automatically. These do **not** happen automatically:

1. `infra/docker/web.Dockerfile` — add `COPY <path>/package.json <path>/` to the
   deps stage.
2. `infra/docker/landing.Dockerfile` — same COPY list, separately.
3. If it ships raw TS/TSX consumed by Next, add it to `transpilePackages`; if it
   wraps a native or socket-opening module, add that to `serverExternalPackages`.
4. If it contains Tailwind classes, add an `@source` line to
   `apps/landing/src/styles/global.css` — the only Tailwind-rooted app.
5. If it has tests, repeat the four-part Vitest wiring in
   `.claude/rules/testing.md`.

Miss 1 or 2 and `pnpm install --frozen-lockfile` fails inside Docker only — the host
build stays green. Always verify with `pnpm stack:up`, not just `pnpm build`.

## Turbo task graph

`turbo.json` defines `build`, `dev`, `lint`, `test`, `typecheck`, `clean`. `build`
declares `env` for `DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_*`, `BETTER_AUTH_URL`,
`BETTER_AUTH_SECRET`, and the three `MICROSOFT_*` vars, plus
`globalDependencies: [".env"]`. A new build-time env var must be listed there or
turbo will serve a cached build that baked in the old value.

`lint`, `test`, and `typecheck` all `dependsOn: ["^build"]`, so they build
dependencies first — expect them to be slower than a bare `tsc`.

**Turbo 2 runs strict env mode**: a task sees only the vars it declares, so `dev`
and `test` repeat `build`'s `env` list. Miss it and the symptom is not an error —
`process.env.DATABASE_URL` is simply `undefined` inside `next dev`, and Postgres
answers "no PostgreSQL user name specified in startup packet". A new env var goes in
every task that reads it, not just `build`.

## Package naming

Scope is `@ihp/*`; `name` matches the folder (`apps/web` → `@ihp/web`). Filters use
that name: `pnpm --filter @ihp/web build`, `turbo run dev --filter=@ihp/landing`.
Root scripts in `package.json` are the source of truth for those filters — add a
`dev:*` script when adding an app.

## Env vars

`.env` at the repo root is the single env file; both compose files load it with
`--env-file .env`, and the root `dev`/`build`/`test` scripts load it with
`dotenv-cli` because turbo 2 does not read `.env` itself.

Host dev uses `localhost` hosts, in-container uses service names
(`postgres`, `redis`) — that fork is documented in `.env.example` and set in
`infra/compose.yml` per service. Any new variable goes in `.env.example` with a
comment, and in `turbo.json` `env` if the build reads it.
