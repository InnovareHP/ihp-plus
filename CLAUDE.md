# ihp-plus

pnpm workspace monorepo: Astro 7 static marketing site (`/`) + Next.js 16 App Router
app (`/app`) behind one nginx origin. `apps/web` is **Mantine v9**; `apps/landing` is
**Tailwind v4 + `@ihp/ui`**. Shared tsconfig/Tailwind tokens in `@ihp/config`.
Postgres is reached through `@ihp/db` (Prisma 7 + the `@prisma/adapter-pg` driver
adapter, migrations in `packages/db/prisma/migrations`). Redis runs but **nothing reads `REDIS_URL` yet** — propose
a client before assuming one.

Read `README.md` for the layout table and the dev/stack commands.

## Docs MCP servers

`.mcp.json` wires two documentation servers, both enabled in `.claude/settings.json`.
Query them instead of recalling an API from training data:

- **better-auth** (`https://mcp.better-auth.com/mcp`) — Better Auth docs, examples,
  setup help. Use before writing any auth code. Better Auth **1.7.3 is installed**
  in `apps/web` on the Prisma adapter (`@better-auth/prisma-adapter`, a separate
  package in 1.7 — not `better-auth/adapters/prisma`).
- **mantine** (`npx @mantine/mcp-server`) — `list_items`, `get_item_doc`,
  `get_item_props`, `search_docs`. The server tracks the Mantine release, so it
  documents **v9**, which is what `apps/web` runs. Mantine is the UI layer in
  `apps/web` only; `apps/landing` stays Tailwind + `@ihp/ui`. **Never mix the two
  design systems inside one app.**

## Working rules

- Node >= 22.12, pnpm 10 only. Never `npm` or `yarn` — the lockfile is pnpm's.
- Workspace deps use `workspace:*`. Add deps with `pnpm add -F @ihp/<pkg> <dep>`,
  never by hand-editing a `package.json`.
- Verify with `pnpm typecheck`, `pnpm test`, then `pnpm lint`, and format before
  finishing. `typecheck` runs in `@ihp/web`, `@ihp/ui`, `@ihp/db` (`tsc --noEmit`)
  and `@ihp/landing` (`astro check`) — `@ihp/config` has no script. `lint` and `test`
  are web-only; Astro and the packages have no eslint config or tests.
- **Every major feature ships with tests** — see `.claude/rules/testing.md`. Vitest +
  Testing Library + `vitest-axe` are installed in `@ihp/web`; run `pnpm test`. Never
  claim a suite passed without running it.
- `pnpm format`'s glob is repo-wide and the checked-in tree is **not** prettier-clean,
  so a bare `pnpm format` rewrites ~10 unrelated files. Format only the paths you
  touched (`pnpm exec prettier --write <paths>`).
- **Commit at every major milestone.** Finish a coherent chunk → `git add` the files
  it touched and commit with a message saying what changed and why. Do not batch a
  whole session into one commit, and never `git push` (that's the user's call).
- **Files sort by concern, not by feature alone**: `components/`, `hooks/`, `utils/`
  inside `src/features/<feature>/`, and a reusable card/stat/badge never sits inline in
  a page. See **File layout** in `.claude/rules/code-style.md`.
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
- Never hand-edit the models in `packages/db/prisma/schema.prisma`; they are Better
  Auth CLI output — regenerate with `pnpm db:auth-schema`. It rewrites the whole file,
  so app models added below them are lost; keep those in a separate `.prisma` file.
- `packages/db/src/generated/` is Prisma Client output: gitignored, rebuilt by
  `pnpm --filter @ihp/db build`, and version-coupled to `@prisma/client`. Never edit
  it and never commit it.

## Rules

@.claude/rules/code-style.md
@.claude/rules/frontend-patterns.md
@.claude/rules/accessibility.md
@.claude/rules/testing.md
@.claude/rules/rpc.md
@.claude/rules/monorepo-wiring.md
@.claude/rules/infra.md
