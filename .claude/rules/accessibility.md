# Accessibility (ADA)

Both apps ship to **WCAG 2.1 level AA** — the ADA/Section 508 bar. Accessibility is
part of the feature, not a follow-up ticket; a PR that adds an inaccessible control
is not done.

## Non-negotiables

- **Semantic HTML first.** `button` for actions, `a[href]` for navigation, real
  `ul`/`table`/`nav`/`main`/`header`/`footer`. ARIA only when no element carries the
  semantics; never `role="button"` on a `div`.
- **One `h1` per page**, headings in order, no level skipped for styling. Size comes
  from a Tailwind class, not from picking a lower heading.
- **Every interactive element is keyboard reachable and operable** with Tab /
  Shift-Tab / Enter / Space / Escape, in DOM order. No positive `tabIndex`. No
  keyboard trap.
- **Visible focus.** The `focus-visible:ring-brand-500 ring-2 ring-offset-2` pattern
  in `packages/ui/src/button.tsx` is the house style — reuse it. Never
  `outline-none` without a replacement indicator.
- **Accessible name on everything.** Icon-only buttons get `aria-label`; images get
  real `alt` (empty `alt=""` only when decorative); `title` is not a name.
- **Contrast** ≥ 4.5:1 text, ≥ 3:1 large text and UI boundaries. Brand tokens are
  OKLCH in `packages/config/tailwind/theme.css` — measure a new pairing, don't
  eyeball it. `text-brand-700` on white is the safe link pairing already in use;
  `brand-500` on white is not.
- **Never color alone.** Error, success, and required states carry text or an icon
  too.
- **Zoom/reflow**: usable at 200% zoom and 320px width, no horizontal scroll.
- **Respect `prefers-reduced-motion`** for any animation or transition beyond a
  color change.
- `lang` on `html` (already set in both apps) and a unique, descriptive `title` per
  page.

## Forms

Pairs with `.claude/rules/frontend-patterns.md` — react-hook-form owns the state,
this owns the markup:

- A real `<label htmlFor>` for every input; placeholder is never the label.
- Required fields: `required` + `aria-required`, and the word "required" in the
  label — not just an asterisk.
- Invalid fields: `aria-invalid="true"` plus `aria-describedby` pointing at the
  error element's `id`.
- Error text sits in a container with `role="alert"` (or `aria-live="polite"` for a
  summary), so RHF validation is announced, not just painted.
- On failed submit, move focus to the first invalid field or an error summary.
- Group related controls in `fieldset`/`legend`.

## Dynamic UI

- Async results, toasts, and query errors announce via a live region — a spinner
  alone is invisible to a screen reader.
- Modals and menus: focus moves in on open, is trapped while open, returns to the
  trigger on close, Escape closes. Use a headless primitive rather than
  hand-rolling this.
- Disclosure controls carry `aria-expanded` and `aria-controls`.
- Route changes in `apps/web` should announce the new page title.

## Per app

- `apps/landing` (Astro, static): a skip link to `#main` as the first focusable
  element, and `<main id="main">` in `Layout.astro` — **not present today, add it
  with the next landing change**. Keep it zero-JS; anything needing `client:*` must
  still work with the keyboard.
- `apps/web` (Next, `/app`): the same skip-link rule in the root layout, and
  `@ihp/ui` components must be accessible at the source — props must allow
  `aria-*` passthrough, which the `...props` spread in `Button`/`Card` already does.

## Verification

Every accessible feature gets an automated check plus a manual pass:

1. `jest-axe`/`vitest-axe` assertion in the component test (see
   `.claude/rules/testing.md`) — zero violations.
2. `eslint-plugin-jsx-a11y` clean (via `eslint-config-next`, already active in
   `apps/web`).
3. Manual: keyboard-only walkthrough of the flow, and a 200% zoom check.

Automated tooling catches roughly a third of WCAG failures — never report an
accessibility pass on axe output alone.
