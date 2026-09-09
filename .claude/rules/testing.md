# Testing

**Every major feature ships with tests.** A feature is done when its tests pass —
not when it renders. No "tests to follow", no PR that adds a form, a query, or an
RPC call with nothing covering it.

## Stack (not installed yet — the first tested feature installs it)

```bash
pnpm add -Dw vitest @vitest/coverage-v8
pnpm add -D -F @ihp/web @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom jsdom vitest-axe
```

Then: a `vitest.config.ts` per workspace that has tests, a `"test": "vitest run"`
script in each, a `test` task in `turbo.json` (`dependsOn: ["^build"]`, no
`outputs`), and `pnpm test` at the root. Update `.claude/skills/stack/stack-config.md`
and the README script table in the same change.

Vitest over Jest: the repo is ESM + Vite already (Astro), and Next 16 works with it.

## What must be tested

| Change | Minimum coverage |
| --- | --- |
| `@ihp/ui` component | render, each variant/size, disabled, keyboard interaction, axe clean |
| form | valid submit, each validation rule, server error via `setError`, error announced |
| TanStack Query hook | success, error, and the invalidation a mutation triggers |
| CRUD mutation | optimistic value visible before the server resolves, **and** the cache restored to the snapshot on failure with the error announced |
| RPC call | success and a `ConnectError` code path, against the generated client type |
| route handler | happy path + failure status |
| bug fix | a test that fails before the fix |

Trivial presentational tweaks and copy changes need no test. Anything with a
branch, a boundary, or user input does.

## How to write them

- Test behaviour through the DOM as a user meets it: `getByRole` /
  `getByLabelText` first, `getByText` next. Never `getByTestId` for something that
  has a role or a label — if a query is hard to write, the markup is probably
  inaccessible.
- Drive interactions with `user-event`, not raw `fireEvent`.
- Assert on rendered output and calls at the boundary; never on internal state,
  hook internals, or implementation details.
- Mock at the transport/service edge (the generated RPC client), not at
  `useQuery`. Give each test a fresh `QueryClient` with retries off.
- No snapshot tests as a substitute for an assertion.
- One `expect(await axe(container)).toHaveNoViolations()` per interactive
  component, per `.claude/rules/accessibility.md` — plus a keyboard-path test for
  anything with focus behaviour.
- Colocate as `<name>.test.tsx` next to the source.

## Running

`pnpm test` before finishing any feature, alongside `pnpm typecheck` and
`pnpm lint` (see `/verify`). Report real output on failure; never claim a suite
passed without running it.
