# Monorepo wiring

The parts of this repo that break silently. Every item is a real coupling in the
current tree, not general advice.

## Shared UI is source-only

`@ihp/ui` exports raw `.tsx` (`exports: { ".": "./src/index.ts", "./*": "./src/*.tsx" }`).
There is no build step and no `dist/`. Consumers compile it:

- Next: `transpilePackages: ['@ihp/ui']` in `apps/web/next.config.ts`.
- Astro: Vite compiles it as workspace source, no config needed.

Do not add a build script, `tsup`, or a `main`/`dist` field to `packages/ui`.

## Tailwind must be told to scan the shared package

Tailwind v4 only scans the app it is rooted in. Both apps therefore carry:

```css
@source '../../../../packages/ui/src';
```

in `apps/web/src/app/globals.css` and `apps/landing/src/styles/global.css`. A class
used only inside `@ihp/ui` gets dropped from the CSS if that line is missing or the
relative depth is wrong. New app, or a moved global CSS file → fix the `@source`
path and check a `brand-*` class actually renders.

## Adding a workspace package: the four-place checklist

`pnpm-workspace.yaml` globs `apps/*` and `packages/*`, so the folder is picked up
automatically. These do **not** happen automatically:

1. `infra/docker/web.Dockerfile` — add `COPY <path>/package.json <path>/` to the
   deps stage.
2. `infra/docker/landing.Dockerfile` — same COPY list, separately.
3. If it ships raw TSX consumed by Next, add it to `transpilePackages`.
4. If it contains Tailwind classes, add an `@source` line in every app's global CSS.

Miss 1 or 2 and `pnpm install --frozen-lockfile` fails inside Docker only — the host
build stays green. Always verify with `pnpm stack:up`, not just `pnpm build`.

## Turbo task graph

`turbo.json` defines `build`, `dev`, `lint`, `typecheck`, `clean`. `build` declares
`env: ["DATABASE_URL", "REDIS_URL", "NEXT_PUBLIC_*"]` and `globalDependencies: [".env"]`.
A new build-time env var must be listed there or turbo will serve a cached build
that baked in the old value.

`lint`/`typecheck` both `dependsOn: ["^build"]`, so they build dependencies first —
expect them to be slower than a bare `tsc`.

## Package naming

Scope is `@ihp/*`; `name` matches the folder (`apps/web` → `@ihp/web`). Filters use
that name: `pnpm --filter @ihp/web build`, `turbo run dev --filter=@ihp/landing`.
Root scripts in `package.json` are the source of truth for those filters — add a
`dev:*` script when adding an app.

## Env vars

`.env` at the repo root is the single env file; both compose files load it with
`--env-file .env`. Host dev uses `localhost` hosts, in-container uses service names
(`postgres`, `redis`) — that fork is documented in `.env.example` and set in
`infra/compose.yml` per service. Any new variable goes in `.env.example` with a
comment, and in `turbo.json` `env` if the build reads it.
