# Code style

What this repo already does. Copy it rather than reformatting to taste.

## Formatting

`.prettierrc`: **no semicolons**, single quotes, 100 print width, trailing commas.
`prettier-plugin-astro` handles `.astro`. Run `pnpm format` before finishing a
change; do not add a competing eslint formatting rule.

`pnpm format`'s glob is `**/*.{ts,tsx,astro,md,json,css}` — **`.mjs` is not
covered**. That is why `apps/web/eslint.config.mjs` and `postcss.config.mjs` still
carry create-next-app's semicolons and double quotes. Leave them; don't reformat
`.mjs` by hand either.

## Comments

**One sentence, maximum.** Existing comments in this repo are the model:
`// Astro owns "/", Next is mounted under "/app" by the nginx proxy.`

- Explain *why* — a constraint, a gotcha, a non-obvious coupling. Never restate what
  the line does.
- No multi-paragraph block comments, no JSDoc on obvious props, no commented-out
  code, no `// TODO` without an owner and a reason.
- If one sentence cannot carry it, the code needs a better name or the note belongs
  in `.claude/rules/`.

Exception: file-top banners in `infra/` (a shell/YAML/Dockerfile header stating how
to invoke the file) may run a few lines — that pattern is already established.

## TypeScript

All tsconfigs extend `@ihp/config/tsconfig/base.json`, which is strict **plus**
`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch`. Consequences to write for, not fight:

- Indexed access is `T | undefined`. Narrow it; do not add `!`.
- An unused param must be dropped, not renamed `_x` and left.
- `noEmit` everywhere — nothing in this repo compiles to `dist/`.

`apps/web` adds `paths: { "@/*": ["./src/*"] }`. Use `@/...` inside web, relative
imports inside `packages/ui` and `apps/landing`.

## React components (`packages/ui`)

Follow `src/button.tsx` and `src/card.tsx` exactly — they are the pattern:

- Named function export, no default export. Props interface exported alongside
  (`ButtonProps`), extending `ComponentPropsWithoutRef<'button'>`.
- Variant/size maps as `const x: Record<Variant, string>` above the component.
- Class merging is a literal `[...].join(' ')` with `className ?? ''` last. There
  is **no `cn`/clsx/tailwind-merge dependency** — do not import one; if merge
  semantics are genuinely needed, propose adding it first.
- No `'use client'` in `@ihp/ui` unless the component needs hooks or handlers —
  it is consumed by both RSC (Next) and Astro islands.
- Every new component gets a re-export (value + type) in `src/index.ts`.

## Styling

One design system per app; never both in one app.

**`apps/landing`** — Tailwind v4, CSS-first. Design tokens live only in
`packages/config/tailwind/theme.css` (`--color-brand-*`, `--font-sans`,
`--radius-card`). Use the token classes (`bg-brand-600`, `rounded-card`,
`font-sans`); add a new token to `theme.css` rather than hardcoding a hex or an
arbitrary value. There is no `tailwind.config.js` and none should be added.

**`apps/web`** — Mantine v9. Tailwind is not installed there. Style with Mantine
props and its CSS variables (`var(--mantine-color-body)`,
`var(--mantine-spacing-md)`); the theme is `apps/web/src/theme.ts`, whose `brand`
tuple mirrors the same OKLCH ramp. No `className` utility strings, no `style` prop
where a Mantine prop exists, and no arbitrary hex.

## Next.js app (`apps/web`)

- App Router with RSC. Server component by default; add `'use client'` only at the
  leaf that needs it.
- `basePath: '/app'` — every route lives under `/app`. Use `next/link` and
  `NextResponse` so the basePath is applied for you; never hardcode `/app/...` in
  an internal href.
- Route handlers follow `src/app/api/health/route.ts`: named HTTP-verb export,
  `NextResponse.json`, explicit `export const dynamic` when the route must not be
  statically evaluated.
- **Next strips `basePath` from `request.url` inside a route handler** — a handler at
  `/app/api/x` sees `http://host/api/x`. Anything that routes on the pathname (Better
  Auth does) needs `/app` put back first; see `src/app/api/auth/[...all]/route.ts`.
  `request.nextUrl.pathname` in `proxy.ts` is stripped the same way, but `NextURL`
  re-adds the prefix when it serialises, so redirects built from it are correct.
- A `proxy.ts` matcher group (`'/((?!api/).*)'`) requires at least one character, so
  it never matches `/`. List `'/'` separately or the root route goes unguarded.
- The root `layout.tsx` types children via Next 16's generated `LayoutProps<'/'>`.
  A **route-group** layout cannot: both it and the root layout sit at `'/'`, so those
  take a hand-written `{ children: ReactNode }`.
- Route groups carry the structure: `(auth)/` is session-free, `(dashboard)/` requires
  one, and neither appears in the URL. Paths live in `src/lib/routes.ts` — never a
  literal `'/login'` in a component.
- Feature code goes in `src/features/<feature>/` (schema, messages, components).
  `src/lib` is cross-cutting singletons; `src/components` is app chrome.
- A server component cannot pass `component={Link}` into a Mantine component — that
  ships a function across the RSC boundary and fails at build. Put the leaf in a
  `'use client'` file.

## Astro app (`apps/landing`)

- `output: 'static'` — no SSR, no server endpoints, no runtime env access. Anything
  needing a server belongs in `apps/web`.
- Pages in `src/pages/`, wrapped in `src/layouts/Layout.astro` (takes `title`,
  optional `description`).
- Import `@ihp/ui` components directly in `.astro` frontmatter for static render.
  Interactivity needs an explicit `client:*` directive — default to zero JS.
