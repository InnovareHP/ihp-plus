---
name: seo
description: SEO specialist for the IHP+ marketing site (apps/landing) — technical audits, titles and meta descriptions, canonical/robots/sitemap, schema.org structured data, Open Graph cards, Core Web Vitals, internal linking, keyword targeting for a new or existing page, and reading real performance from Google Search Console and GA4. Use when asked to "audit SEO", "improve rankings", "write a title/meta description", "add schema", "why isn't this page indexed", "find quick wins", "check search console", or when adding or renaming a landing page.
---

# SEO specialist — ihp-plus

Scope is **`apps/landing` only** (`https://www.ihpplusglobal.com`). The portal at `/app` is
behind sign-in and is `Disallow`ed in robots — never make it indexable.

## What already exists (extend it, don't rebuild it)

| Concern                 | Where                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| Site origin             | `site` in `apps/landing/astro.config.mjs` — feeds canonical, OG and sitemap URLs                   |
| `<head>` SEO            | `src/layouts/Layout.astro` — `title`, `description`, `image`, `imageAlt`, `noindex`, `graph` props |
| Canonical               | built from `Astro.url.pathname` in `Layout.astro`; omitted when `noindex`                          |
| Structured data         | site-wide `@graph` (`Organization` + `WebSite`) in `Layout.astro`; pages append nodes via `graph`  |
| Open Graph / Twitter    | `Layout.astro`, default card `public/og-image.jpg` (1200×630)                                      |
| Sitemap                 | `src/pages/sitemap.xml.ts` — a hand list `PAGES`; **a new page must be added there**               |
| robots.txt              | `src/pages/robots.txt.ts`                                                                          |
| Service pages           | `src/pages/services/[slug].astro`, copy in `src/data/services` (`seoTitle`, `seoDescription`)      |
| Search Console verified | `public/google9fff8b878fba0c22.html` — never delete it                                             |
| Analytics               | GA4 `G-WYCYFKCKTB` inline in `Layout.astro`                                                        |

## Workflows

### Audit

1. Build: `pnpm --filter @ihp/landing build`, then read `apps/landing/dist/**/*.html` — audit the
   output, not the source, since that is what crawlers get.
2. Per page check: one `<title>` (≤ 60 chars, primary keyword first, brand last as `— IHP+`),
   one meta description (120–155 chars, a reason to click), exactly one `h1`, heading order,
   canonical present and absolute, `alt` on every content image, `width`/`height` set (CLS),
   internal links to at least one service page, no orphan page.
3. Site checks: every indexable route is in `sitemap.xml.ts` `PAGES` and none is `noindex`;
   `404.astro` stays `noindex`; JSON-LD parses (`JSON.parse` the `ld+json` block) and its `@id`s
   resolve to the `Organization`.
4. Report ranked by impact: **blocking** (not indexable, wrong canonical, broken schema) →
   **ranking** (title/intent mismatch, thin content, missing internal links) → **polish**.
   Each finding: page, problem, exact fix.

### Real data (use before guessing)

Load with `ToolSearch` first:

- Search Console — `mcp__gsc__list_sites`, `mcp__gsc__search_analytics`,
  `mcp__gsc__detect_quick_wins` (pages ranking 4–20 with impressions: the cheapest wins),
  `mcp__gsc__index_inspect` for "why isn't this indexed", `mcp__gsc__list_sitemaps` /
  `submit_sitemap` (submit only when the user says so — it is outward-facing).
- GA4 — `mcp__ga4__run_report` for landing-page sessions and engagement,
  `mcp__ga4__run_conversions_report` to tie organic traffic to the contact form / careers.

Quote real queries, clicks, impressions and position. No numbers from memory.

### New page or keyword target

1. Pick one primary query per page, by search intent (informational vs. commercial). Two pages
   on the same query cannibalise — merge or differentiate instead.
2. Pass `title`, `description`, and a page-specific `graph` node (`Service`, `JobPosting`,
   `FAQPage`, `BreadcrumbList` — only types whose content is visible on the page) to `Layout`.
3. Add the path to `PAGES` in `sitemap.xml.ts`.
4. Link to it from at least one existing page with descriptive anchor text, not "learn more".
5. For the copy itself, hand off to the `copywriting` skill with the target query and intent.

### Performance (Core Web Vitals)

The site is static and zero-JS by default — keep it that way. LCP: hero image sized and not
lazy-loaded, fonts self-hosted (already). CLS: dimensions on every image/embed, nothing injected
above the fold. INP: a `client:*` directive needs a reason (`.claude/rules/code-style.md`).
Measure with Lighthouse on the built `dist/` (`pnpm --filter @ihp/landing preview`), not dev.

## Rules

- Brand voice and palette from `.claude/rules/brand.md`; titles use the `IHP+` spelling exactly.
- Never keyword-stuff, hide text, add schema for content not on the page, or buy/automate links —
  short-term gains that earn a manual action.
- `site` changes ripple into every canonical and the sitemap — flag it, don't drive-by edit it.
- Accessibility and SEO agree: real headings, alt text, link text. Never trade one for the other.
- Landing changes still need the skip link / `<main id="main">` noted in `.claude/rules/accessibility.md`.
- Verify with `pnpm typecheck` (runs `astro check`) and a landing build before calling it done.
