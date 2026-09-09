# ihp-plus

pnpm workspace monorepo: Astro 7 static marketing site (`/`) + Next.js 16 App Router
app (`/app`) behind one nginx origin. Shared React components in `@ihp/ui`, shared
tsconfig/Tailwind tokens in `@ihp/config`. Postgres + Redis run in Docker but **no
client is installed yet** — there is no ORM, no `packages/db`, no migrations. Do not
write code that assumes one exists; propose the package first.

Read `README.md` for the layout table and the dev/stack commands.

## Working rules

- Node >= 22.12, pnpm 10 only. Never `npm` or `yarn` — the lockfile is pnpm's.
- Workspace deps use `workspace:*`. Add deps with `pnpm add -F @ihp/<pkg> <dep>`,
  never by hand-editing a `package.json`.
- Verify with `pnpm typecheck` then `pnpm lint`, and `pnpm format` before finishing.
  `typecheck` runs in `@ihp/web`, `@ihp/ui` (`tsc --noEmit`) and `@ihp/landing`
  (`astro check`) — `@ihp/config` has no script. `lint` is web-only; Astro and the
  packages have no eslint config.
- **Every major feature ships with tests** — see `.claude/rules/testing.md`. No test
  runner is installed yet; the first tested feature adds Vitest + Testing Library and
  wires `pnpm test`. Until then, do not claim a suite passed.
- **Commit at every major milestone.** Finish a coherent chunk → `git add` the files
  it touched and commit with a message saying what changed and why. Do not batch a
  whole session into one commit, and never `git push` (that's the user's call).
- Match the surrounding style: no semicolons, single quotes, 100 cols (`.prettierrc`).
- **Comments are one sentence, maximum.** Explain why, never what; delete rather than
  extend.
- `apps/web/AGENTS.md` (imported by `apps/web/CLAUDE.md`) is generated and rewritten
  by `next dev`. Do not hand-edit it. Next 16 differs from older Next — check
  `apps/web/node_modules/next/dist/docs/` before writing App Router code.

## Restrictions

- Commit freely at milestones; **never push**, never force-push.
- `.env` is real local config and gitignored — never read it, never overwrite it.
  Document new variables in `.env.example` instead.
- Never `docker compose down -v`, `docker volume rm`, or prune volumes: that wipes
  the local Postgres data volume.
- Ports are fixed: web 3000, landing 4321, proxy `PROXY_PORT` (default 80). Don't
  change them to dodge a conflict — report the conflict.

## Rules

@.claude/rules/code-style.md
@.claude/rules/frontend-patterns.md
@.claude/rules/accessibility.md
@.claude/rules/testing.md
@.claude/rules/rpc.md
@.claude/rules/monorepo-wiring.md
@.claude/rules/infra.md
