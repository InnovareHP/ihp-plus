# Frontend patterns

State, forms, and data fetching in `apps/web`. **None of these packages are
installed yet** — the first task that needs one installs it:

```bash
pnpm add -F @ihp/web react-hook-form @hookform/resolvers zod @tanstack/react-query
```

Do not hand-roll a substitute for any of them.

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

## useState: the exception, not the default

Before adding `useState`, place the state in one of these first:

| State really is | Use |
| --- | --- |
| form field / validation / submit status | react-hook-form |
| server data, its loading + error status | TanStack Query |
| URL-worthy (filters, tab, page, sort) | `useSearchParams` + `router.replace` |
| derived from props or other state | compute during render, no state at all |
| a DOM value nothing renders | `useRef` |

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
- **Touch every affected key**: a create or delete updates the list key *and* the
  detail key; an item inside a paginated or filtered list updates the key holding it.
- **Creates need a temporary id** (`crypto.randomUUID()`), replaced by the server's
  id on settle. Never key a list row by array index.
- **Deletes remove the row immediately** and restore it in place on failure.
- **Rollback must be announced**, not silent — surface the error in a live region
  (`.claude/rules/accessibility.md`) so the row snapping back is explained. Field-level
  failures also go through `setError`.
- **Disable the control while `isPending`** only where a double submit is harmful;
  the point of optimism is that the UI has already moved on.
- Skip optimism only when the server's response is unpredictable (server-computed
  totals, ordering, or side effects the client cannot model). Say why in one
  sentence at the mutation.

Every optimistic mutation is tested on both paths — applied, and rolled back
(`.claude/rules/testing.md`).

## Composition

Keep the data hook, the form, and the presentational component separate: a
`use<Feature>Query`/`use<Feature>Mutation` hook, a form component owning
`useForm`, and a dumb component from `@ihp/ui`. `@ihp/ui` stays presentational —
no queries, no `useForm`, no fetching inside it.
