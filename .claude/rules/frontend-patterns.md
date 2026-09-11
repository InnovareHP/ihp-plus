# Frontend patterns

How `apps/web` is built: the mechanics (state, forms, data) **and** the UX flow they
have to produce. Two people are served by every screen — the **user**, who wants the
task done in as few decisions as possible, and the **owner**, who needs the flow to
convert, be recoverable when it fails, and be measurable. A pattern that helps one and
taxes the other is the wrong pattern.

Pairs with `.claude/rules/accessibility.md` (WCAG AA is part of the flow, not a pass at
the end) and `.claude/rules/code-style.md` (tokens, `@ihp/ui` component shape).

## Packages

**Installed in `@ihp/web`:** `react-hook-form`, `@hookform/resolvers`, `zod` (v4 —
`z.email()`, not the deprecated `z.string().email()`), `@tanstack/react-query`,
`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`.

Do not hand-roll a substitute for any of them. **Mantine v9 is the UI layer in
`apps/web`** — it supplies the dialog, menu, toast, and focus-trap primitives this
file assumes, so no Radix and no hand-rolled focus trap or toast queue. Tailwind and
`@ihp/ui` are **not** installed in web; they stay in `apps/landing`. Anything Mantine
does not cover still needs a proposal and a yes before it is installed.

Theme tokens for web live in `apps/web/src/theme.ts`, which mirrors the OKLCH ramp in
`packages/config/tailwind/theme.css` as Mantine shades. `primaryShade` is 6 in light
and 4 in dark from measured contrast; `autoContrast` is on. Add a shade there rather
than hardcoding a colour on a component.

## Principles

1. **Every state is a designed state.** Loading, empty, and error are screens, not
   afterthoughts.
2. **The UI moves first.** Optimistic where the result is predictable; never a
   spinner where a value could already be shown.
3. **The URL is the state.** Anything worth returning to, sharing, or bookmarking
   lives in the address bar.
4. **Reversible beats confirmable.** Offer undo instead of an "are you sure" dialog
   whenever the action can be taken back.
5. **One primary action per view.** Everything else is visually secondary.
6. **Say what happened and what to do next.** No dead ends, no raw error codes.
7. **Instrument the flow you ship.** An unmeasured funnel cannot be improved by the
   owner.

## The five states of every screen

Build all five before calling a view done. Missing one is the most common defect in
this repo's kind of app.

| State       | What ships                                                         |
| ----------- | ------------------------------------------------------------------ |
| **Ideal**   | real data, primary action obvious                                  |
| **Loading** | skeleton with the same layout as the ideal state, `aria-busy`      |
| **Empty**   | one sentence saying why it is empty + the control that fills it    |
| **Error**   | plain-language cause, a retry control, no lost user input          |
| **Partial** | few rows, long strings, missing fields — must not break the layout |

Rules:

- **Skeletons, not spinners**, for anything with a known shape (list, card, table).
  A spinner is for an unknown, short wait inside a control.
- The skeleton matches the final layout's box sizes — a skeleton that reflows on load
  is worse than none (layout shift, and it reads as a glitch).
- **First paint has no flash.** Do not show a loading state for data resolved on the
  server; stream it (`loading.tsx` + `Suspense`) instead of blanking the shell.
- Empty state ≠ error state ≠ "no results for this filter". The last one keeps the
  filters visible and offers **Clear filters**.
- Error states never discard typed input; re-render the form with its values.

## Perceived performance

Budgets, in order of the human thresholds they map to:

- **< 100 ms** — feels instant. Every local interaction (open, toggle, select, tab
  switch) lands here; no network on the path.
- **< 1 s** — flow unbroken. Navigation and mutations aim here; optimistic updates
  _report_ instant even when the server is slower.
- **> 1 s** — needs feedback. Show the skeleton or progress and keep it in place
  until the data lands.
- **Delay spinners ~300 ms.** A spinner that flashes for 80 ms is noise; render it
  only if the wait outlives the delay.
- **Never move the layout under a click.** Reserve space for async content — badges,
  counts, images (`width`/`height` always set).
- Prefetch what the user is about to need: `next/link` prefetches by default, keep
  it, and warm the cache with `prefetchQuery` for the row a hover opens.

## Feedback and destructive actions

- **Inline first, toast second.** Feedback belongs next to the thing that changed; a
  toast is for a result the user has scrolled away from.
- Toasts: one at a time, ~5 s for success, **error toasts do not auto-dismiss**, and
  every toast is announced in a live region (`.claude/rules/accessibility.md`).
- **Undo over confirm** for anything reversible: apply immediately, show
  "Deleted 3 leads · Undo" for ~10 s, commit on dismiss. Faster for the user and
  cheaper for the owner than a modal on every delete.
- Confirm dialogs are for the genuinely irreversible only. Then: name the object in
  the copy, label the button with the verb (**Delete lead**, never "OK"), and require
  typing the name for account- or org-level destruction.
- Success needs no toast when the change is visible on screen — the row updating _is_
  the feedback.
- A failed action leaves the UI in its pre-action state, with the reason visible and
  the control ready to retry.

## Navigation and URL state

- `basePath: '/app'` — always `next/link` and `NextResponse`, never a hardcoded
  `/app/...` href (`.claude/rules/code-style.md`).
- **URL-worthy state goes in the URL**: filters, search text, sort, page, active tab,
  open detail id. `useSearchParams` to read; `router.replace` for a control the user
  is adjusting (no history spam), `router.push` for a real navigation.
- Debounce search into the URL (~300 ms); the input itself stays a react-hook-form
  field, not `useState`.
- Every route segment with data ships `loading.tsx`; every segment that can fail
  ships `error.tsx` with a working **Try again** (`reset()`); the app ships
  `not-found.tsx`. Next 16 differs from older Next — check
  `apps/web/node_modules/next/dist/docs/` before writing these.
- Back must work: browser back never loses filters, scroll position, or a half-typed
  form the user returned to.
- Breadcrumbs on anything more than two levels deep, and the route change announces
  the new page title (`.claude/rules/accessibility.md`).
- Deep links stand alone — a link to a detail view renders it without the user first
  passing through the list.

## Forms: react-hook-form, always

Every form — including a single-input search or filter box — uses `react-hook-form`.
No `useState` per field, no manual `onChange` wiring, no ad-hoc validation.

- `useForm<T>({ resolver: zodResolver(schema), defaultValues })`. Schema first;
  infer the type from it (`z.infer<typeof schema>`), do not declare both.
- Register inputs with `register()`, or `<Controller>` for a component that owns
  its own value. Never mirror a field into local state.
- Submission state comes from `formState` (`isSubmitting`, `isDirty`, `isValid`,
  `errors`) — never a hand-kept `const [loading, setLoading]`.
- Reset with `reset()`, not by remounting with a `key`.
- Server errors go back through `setError('field', ...)` / `setError('root', ...)`
  so they render in the same place as client errors.
- Form components are client components — `'use client'` at the form leaf, not on
  the page or layout.
- Error rendering must satisfy `.claude/rules/accessibility.md` (`aria-invalid`,
  `aria-describedby`, live region). A form that validates but does not announce is
  incomplete.

### Form flow

- **Validate late, forgive early**: `mode: 'onTouched'`, `reValidateMode: 'onChange'`.
  Do not shout at a field the user has not finished typing.
- **Never disable submit on `!isValid`.** A dead button explains nothing — let the
  submit run, then move focus to the first invalid field or the error summary.
- One column, label above the input, related fields in a `fieldset`. Multi-column
  forms cost more scanning than they save in scrolling.
- Ask for the minimum. Every optional field is a decision billed to the user; if the
  owner needs it, mark it required (asterisk only, per
  `.claude/rules/accessibility.md`) and say why in help text.
- Help text sits under the label _before_ the mistake; error text appears in its own
  `role="alert"` node and replaces nothing.
- Type the input for the platform: `type`, `inputMode`, and `autoComplete` on every
  real-world field (email, tel, postal code, one-time code).
- Long or multi-step forms: show step position, keep the step in the URL, and let the
  user go back without losing entries. Autosave a draft rather than warn on exit — an
  exit warning, if any, fires only when `isDirty`.
- Submit is idempotent from the user's side: disable during `isSubmitting` and show
  the button's own pending label ("Saving…"), never a full-page overlay.
- After a successful create the user lands on the thing they made — not back at an
  empty form with a toast.

## useState: the exception, not the default

Before adding `useState`, place the state in one of these first:

| State really is                         | Use                                    |
| --------------------------------------- | -------------------------------------- |
| form field / validation / submit status | react-hook-form                        |
| server data, its loading + error status | TanStack Query                         |
| URL-worthy (filters, tab, page, sort)   | `useSearchParams` + `router.replace`   |
| derived from props or other state       | compute during render, no state at all |
| a DOM value nothing renders             | `useRef`                               |

`useState` survives only for genuinely local, ephemeral UI: an open/closed
disclosure, a hover, an uncontrolled toggle. If a `useState` is set from a `useEffect`,
it is one of the rows above being done by hand — fix it, don't ship it.

## useEffect: last resort

Almost always wrong here. Do not use an effect to:

- fetch data (that's TanStack Query, or a server component)
- sync state to props / derive one state from another (compute during render)
- reset state on a prop change (use a `key`, or `reset()` for forms)
- handle a user event (put it in the handler)
- transform data for rendering (do it inline, memoize only if measured)

Legitimate uses: subscribing to a genuinely external store (prefer
`useSyncExternalStore`), an imperative browser API, or a non-React widget's
lifecycle. Every remaining `useEffect` carries a one-line comment saying which
external system it synchronizes with. No comment → delete it.

## Server data: TanStack Query

- One `QueryClientProvider` in a client boundary component mounted from the root
  layout; do not create a `QueryClient` inside a component body (`useState(() => new QueryClient())`
  at the provider, or a module-level factory guarded for SSR).
- Query keys are arrays, most general → most specific: `['leads', orgId, filters]`.
  Keep them in a `queryKeys` object per feature; never inline a raw string key twice.
- Mutations use `useMutation` + `queryClient.invalidateQueries({ queryKey })` in
  `onSettled`. Do not refetch by flipping a counter in state.
- Read `isPending` / `isError` / `error` from the hook. A `useState` holding a
  loading flag next to a query is a bug.
- Prefer a React Server Component for data that is read once and never refetched;
  reach for Query when the data is interactive — refetched, invalidated, paginated,
  polled, or mutated.
- Keep `placeholderData: keepPreviousData` on paginated and filtered lists so the
  table does not blank out between pages.
- A background refetch stays quiet: `isFetching` may dim or badge the view, only
  `isPending` may replace it with a skeleton.
- Set `staleTime` deliberately per feature; refetch-on-focus everywhere is a flicker
  generator, not freshness.

## Optimistic updates: required for CRUD

Every create, update, and delete applies to the cache immediately and rolls back on
failure. A CRUD mutation that leaves the user staring at a spinner until the server
answers is not done.

The four callbacks, always all four:

```ts
useMutation({
  mutationFn: updateLead,
  onMutate: async (next) => {
    // In-flight refetches would overwrite the optimistic value on arrival.
    await queryClient.cancelQueries({ queryKey: leadKeys.detail(next.id) })
    const previous = queryClient.getQueryData(leadKeys.detail(next.id))
    queryClient.setQueryData(leadKeys.detail(next.id), (old) => ({ ...old, ...next }))
    return { previous }
  },
  onError: (_err, next, ctx) => {
    queryClient.setQueryData(leadKeys.detail(next.id), ctx?.previous)
  },
  onSettled: (_data, _err, next) => {
    queryClient.invalidateQueries({ queryKey: leadKeys.detail(next.id) })
  },
})
```

Rules that follow from it:

- **Cancel before writing.** Skipping `cancelQueries` lets an in-flight refetch land
  on top of the optimistic value.
- **Snapshot and return it** from `onMutate`; `onError` restores that exact
  snapshot. Never "undo" by recomputing the previous value.
- **Invalidate in `onSettled`**, not `onSuccess` — the server stays the source of
  truth on both paths.
- **Touch every affected key**: a create or delete updates the list key _and_ the
  detail key; an item inside a paginated or filtered list updates the key holding it.
- **Creates need a temporary id** (`crypto.randomUUID()`), replaced by the server's
  id on settle. Never key a list row by array index.
- **Deletes remove the row immediately** and restore it in place on failure.
- **Rollback must be announced**, not silent — surface the error in a live region
  (`.claude/rules/accessibility.md`) so the row snapping back is explained. Field-level
  failures also go through `setError`.
- **Disable the control while `isPending`** only where a double submit is harmful;
  the point of optimism is that the UI has already moved on.
- Mark a pending optimistic row visually (dimmed, or a subtle badge) only when the
  wait is long enough to notice — never with a spinner replacing the value.
- Skip optimism only when the server's response is unpredictable (server-computed
  totals, ordering, or side effects the client cannot model). Say why in one
  sentence at the mutation.

Every optimistic mutation is tested on both paths — applied, and rolled back
(`.claude/rules/testing.md`).

## Lists and tables

- Sort, filter, page, and search live in the URL and are paged **server-side**; never
  fetch everything and slice on the client.
- Sticky header, first column readable at 320 px, and the table scrolls horizontally
  in its own container — the page never scrolls sideways
  (`.claude/rules/accessibility.md`).
- On narrow screens a data table becomes a list of cards, not a pinch-zoom target.
- Row actions: at most two inline, the rest in a menu whose accessible name
  identifies the row ("Actions for Acme Corp").
- Bulk selection shows a persistent action bar with the count and a clear way out;
  destructive bulk actions use the undo pattern above.
- A real `<table>` with `<th scope>` for tabular data; a `<ul>` for a list. Never a
  grid of `div`s.
- Virtualize past ~200 rows — and prefer pagination, which is linkable, over infinite
  scroll, which is not. If infinite scroll is required, a **Load more** button is the
  keyboard path.

## Layout, spacing, motion

- Tokens only: `bg-brand-600`, `rounded-card`, `font-sans`. A new value goes in
  `packages/config/tailwind/theme.css`, never inline as a hex or `[13px]`
  (`.claude/rules/code-style.md`).
- Spacing uses Tailwind's 4 px scale, and one page owns one rhythm — pick `gap-4` /
  `gap-6` / `gap-8` and stay there.
- Content width: prose caps near `max-w-prose`, app shells near `max-w-7xl`.
- Touch targets ≥ 44 × 44 px including padding; `size="sm"` buttons are for dense
  desktop tables only.
- Build mobile-first and verify at 320 px, 768 px, 1280 px, plus 200 % zoom.
- Motion is 150–250 ms, ease-out, on `transform`/`opacity` only. Nothing animates the
  position or height of a list the user is reading, and everything respects
  `prefers-reduced-motion` (`.claude/rules/accessibility.md`).
- Dark mode: `Card` already carries `dark:bg-white/5`; anything new stays legible in
  both themes or does not ship.

## Copy

Microcopy is UI. Write it with the component, not after.

- Sentence case everywhere, including buttons and headings.
- Buttons name their action: **Save changes**, **Send invite** — never "Submit", "OK".
- Error formula: what happened, then what to do. "Could not save the lead — check
  your connection and try again." No codes, no stack traces, no "Error: undefined".
- Empty states name the benefit, not the void: "Add your first lead to start tracking
  follow-ups."
- Dates are absolute with a relative hint (`Mar 4, 2026 · 2 days ago`); numbers and
  currency go through `Intl`, never manual string math.

## Instrumentation (the owner's half)

- Every key flow (signup, create, convert, cancel) emits a start event and an outcome
  event — success **and** failure with its reason. A funnel with no failure branch
  hides the exact step losing money.
- Event names are `feature.object.action` (`leads.lead.created`), defined in one
  module per feature next to `queryKeys`, never as inline string literals.
- Never put PII in event properties — ids, not emails or names.
- Client errors escape to an error boundary that reports; a swallowed `catch` is a
  defect.
- No analytics package is installed. Propose one before wiring it, and keep calls
  behind a thin `track()` so the vendor stays swappable.
- `apps/landing` is the conversion surface: one clear primary CTA per page, a real
  `title`/`description` per page (`Layout.astro` takes both), and **zero JS by
  default** — a `client:*` directive needs a reason (`.claude/rules/code-style.md`).

## Composition

Keep the data hook, the form, and the presentational component separate: a
`use<Feature>Query`/`use<Feature>Mutation` hook, a form component owning
`useForm`, and a dumb component from `@ihp/ui`. `@ihp/ui` stays presentational —
no queries, no `useForm`, no fetching inside it.

- Feature folders in `apps/web/src` group by concern — `components/`, `hooks/`,
  `utils/`, then the flat modules (`.claude/rules/code-style.md`). Only genuinely
  shared, presentational pieces move to `@ihp/ui`.
- **The second use promotes it.** A button/badge/field styled ad hoc in two places
  becomes a `@ihp/ui` component following `button.tsx` exactly — variant maps, named
  export, re-export in `src/index.ts`.
- `@ihp/ui` components take state as props (`isPending`, `isInvalid`), never read it
  from a context an app owns, and always spread `...props` so `aria-*` passes through.

## Definition of done

A frontend change is done when all of these hold — not when it renders:

1. All five screen states exist and were seen.
2. Form state is react-hook-form, server state is Query, URL state is in the URL, and
   any remaining `useState`/`useEffect` justifies itself against the tables above.
3. CRUD is optimistic on both paths, with rollback announced.
4. Keyboard-only walkthrough passes and axe is clean
   (`.claude/rules/accessibility.md`).
5. Copy follows the rules above — no placeholder text shipped.
6. The flow emits its start/outcome events.
7. Tests cover it and pass (`.claude/rules/testing.md`), and `pnpm typecheck`,
   `pnpm lint`, `pnpm format` are clean.
