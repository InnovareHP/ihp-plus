import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Mirrors the OKLCH ramp in packages/config/tailwind/theme.css, filled out to Mantine's 10 shades.
const brand: MantineColorsTuple = [
  'oklch(0.97 0.02 250)',
  'oklch(0.93 0.04 250)',
  'oklch(0.86 0.07 250)',
  'oklch(0.78 0.11 250)',
  'oklch(0.68 0.15 250)',
  'oklch(0.58 0.18 250)',
  'oklch(0.5 0.18 250)',
  'oklch(0.42 0.16 250)',
  'oklch(0.35 0.13 250)',
  'oklch(0.28 0.1 250)',
]

export const theme = createTheme({
  primaryColor: 'brand',
  // Measured against white: shade 6 is 5.88:1 and shade 5 only 4.25:1, so 5 is never the primary.
  primaryShade: { light: 6, dark: 4 },
  autoContrast: true,
  colors: { brand },
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontFamilyMonospace: 'ui-monospace, "JetBrains Mono", monospace',
  headings: { fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  defaultRadius: 'md',
  focusRing: 'auto',
  respectReducedMotion: true,
})
