---
description: Run the full local verification pass (typecheck, test, lint, format)
---

Run in this order, stopping to report on first real failure:

1. `pnpm typecheck` — `tsc --noEmit` in web + ui, `astro check` in landing.
2. `pnpm test` — required for any change touching a feature
   (`.claude/rules/testing.md`). If the script does not exist yet, the change that
   needed it should have added Vitest — say so rather than skipping silently.
3. `pnpm lint` — eslint, `apps/web` only. Astro and the packages have no eslint config.
4. `pnpm format` — prettier write, includes `.astro`.
5. If anything under `infra/`, a `package.json`, or `pnpm-lock.yaml` changed,
   `pnpm build` too — the Docker build runs `pnpm install --frozen-lockfile` and
   fails on lockfile drift the host never sees.

Report the actual command output for failures, not a summary. Fix what you broke;
report pre-existing failures separately. When the pass is green and the work is a
coherent chunk, commit it (CLAUDE.md working rules) — do not push.

$ARGUMENTS
