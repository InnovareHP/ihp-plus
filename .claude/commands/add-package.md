---
description: Add a workspace package with every piece of wiring it needs
---

Add a workspace package named $ARGUMENTS (scope `@ihp/`, folder name matching the
package name). Follow `.claude/rules/monorepo-wiring.md`.

1. Decide `apps/` vs `packages/` — both are globbed by `pnpm-workspace.yaml`.
2. Create the folder with a `package.json`: `"name": "@ihp/<name>"`, `"version": "0.0.0"`,
   `"private": true`, `"type": "module"`. Source-only packages export from `src/`
   with no build script and no `dist/` (see `packages/ui/package.json`).
3. `tsconfig.json` extends `@ihp/config/tsconfig/base.json` (or `nextjs.json` for a
   Next app) and adds `@ihp/config` as a devDependency.
4. Add `COPY <path>/package.json <path>/` to the deps stage of **both**
   `infra/docker/web.Dockerfile` and `infra/docker/landing.Dockerfile`.
5. If it ships raw TSX used by Next, add it to `transpilePackages` in
   `apps/web/next.config.ts`.
6. If it contains Tailwind classes, add an `@source` line pointing at its `src` in
   `apps/web/src/app/globals.css` and `apps/landing/src/styles/global.css`, with the
   correct relative depth.
7. If it is an app, add `dev:<name>` to the root `package.json` scripts and update
   the README layout section and script table.
8. Wire consumers with `pnpm add -F @ihp/<consumer> @ihp/<name>@workspace:*`, then
   run `pnpm install` so `pnpm-lock.yaml` is updated in the same change.
9. Verify: `pnpm typecheck`, then `pnpm stack:up` — a missing COPY only fails inside
   Docker.
