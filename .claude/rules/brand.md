# Brand (IHP+)

The source of truth is `(Brand Guidelines) IHP+ 1.pdf` v1 (2026) and the `IHP + LOGOS`
export. Everything below is already wired; match it rather than reinventing a value.

## Palette

Primary — bold blue, white, mint:

| Token                   | Hex       | Use                                  |
| ----------------------- | --------- | ------------------------------------ |
| `brand-600` / Mantine 6 | `#1346C5` | the brand blue, every primary action |
| white                   | `#FFFFFF` | page and card surfaces               |
| `mint-300` / Mantine 3  | `#95E5DC` | accent, never text on white (1.45:1) |

Secondary — depth and soft backgrounds:

| Token                   | Hex       | Use                          |
| ----------------------- | --------- | ---------------------------- |
| `brand-800` / Mantine 8 | `#0B286B` | deep navy, dark chrome       |
| `brand-100` / Mantine 1 | `#DCE7FF` | tinted panels, selected rows |
| `mint-100` / Mantine 1  | `#E3F8F5` | success/positive tints       |
| `ink`                   | `#222222` | body copy                    |
| `canvas`                | `#F7F9FC` | app canvas behind cards      |

Both ramps live once, in OKLCH, in `packages/config/tailwind/theme.css`, and are mirrored
shade-for-shade into Mantine tuples in `apps/web/src/theme.ts` — **Tailwind's `600` is
Mantine's `6`**. Change one, change the other. Measured contrast: `brand-600` is 7.75:1 on
white and `brand-400` is 5.5:1 on Mantine's dark body, which is why `primaryShade` is
`{ light: 6, dark: 4 }`. Mint is an accent only; its darkest usable text shade is `mint-700`
at 4.02:1, still short of AA, so mint never carries text on white.

Transactional email repeats the palette as sRGB hex in `src/lib/email/layout.ts` because no
client resolves OKLCH.

## Type

**Poppins**, self-hosted through `@fontsource/poppins` (latin 400/500/600/700) in both apps —
imported at the top of `apps/web/src/app/globals.css` and `apps/landing/src/styles/global.css`.
No Google Fonts request at runtime.

The marketing site's headlines use **Big Shoulders** (500/600/800) and **Big Shoulders Display** (800),
from the website's Figma file, self-hosted the same way in `apps/landing` only. They are the
`font-display` and `font-poster` tokens; body copy there stays Poppins, and `apps/web` does not load them.

The guidelines' four steps, size/leading verbatim, are Tailwind tokens:
`text-headline` 60/64, `text-headline-2` 30/32, `text-subheading` 20/24, `text-body` 17/20 —
all bold, tracking 0. The 60px headline is the landing hero's; at `sm` and below drop to
`text-headline-2` so nothing overflows 320px.

`apps/web` maps the same scale into Mantine: `fontSizes.md` is the 17px body step and the app
heading scale starts one step down (`h1` 30/32, `h2` 24/30, `h3` 20/24, `h4` 17/20), because a
60px headline is a marketing size, not app chrome.

## Logo

Assets live once, in `apps/landing/public/brand/`. nginx maps `/` to landing, so both apps
reach them at `/brand/...` on the single origin:

| File                         | When                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `logo.svg`                   | default — gradient lockup, reads on light and dark                              |
| `logo-on-light.svg`          | flat blue bubble, mint letters                                                  |
| `logo-on-dark.svg`           | flat mint bubble, blue letters                                                  |
| `logo-mono.svg` / `-reverse` | black-and-white applications                                                    |
| `wordmark*.svg`              | same set without the bubble                                                     |
| `logo-email.png`             | `logo.svg` rasterized to 263×160 for email headers — Gmail and Outlook drop SVG |

`apps/web` renders the lockup inline from `src/components/app-logo.tsx` so it needs no
basePath-aware asset URL and no second copy of the artwork; that file is generated from the
traced originals and is not hand-edited.

Rules carried over from the PDF, which apply to any new placement:

- Never distort, rotate, recolour, outline, shadow, or break the lockup apart.
- Clear space on all four sides is the width of the `+`.
- Minimum width is 240px for the lockup and 160px for the wordmark. **App and browser chrome
  cannot honour this** — the header lockup renders at 46px wide. That is a deliberate,
  documented exception; print and marketing placements hold the minimum.
- The gradient runs bottom-left `#1346C5` → top-right `#95E5DC`; its stops were measured off
  the supplied artwork, so copy the `linearGradient` rather than eyeballing a new one.

Note the supplied wordmark files label their colours the wrong way round: `Wordmark (Light
background).png` is mint and `(Dark background).png` is blue. The repo names them by intent
(`wordmark-on-light.svg` is the blue one).

## Icons

One square tile — the reversed lockup on a `#1346C5` field, an approved colour-background
pairing — generated at every size:

- `apps/web/src/app/{favicon.ico,icon.svg,apple-icon.png}` plus `public/icon-{192,512}.png` and
  `public/icon-maskable-512.png`, wired through `src/app/manifest.ts`.
- `apps/landing/public/{favicon.ico,favicon.svg,apple-touch-icon.png,icon-*.png,site.webmanifest}`,
  linked from `Layout.astro`.

`theme-color` is `#1346c5` in both apps (`#0b286b` for web's dark scheme).
