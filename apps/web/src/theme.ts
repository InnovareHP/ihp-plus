import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Mirrors the OKLCH ramps in packages/config/tailwind/theme.css; Tailwind's 600 is Mantine's 6.
const brand: MantineColorsTuple = [
  'oklch(0.972 0.017 266)',
  'oklch(0.927 0.0347 266)',
  'oklch(0.87 0.064 265)',
  'oklch(0.79 0.108 265)',
  'oklch(0.69 0.152 264)',
  'oklch(0.575 0.19 264)',
  'oklch(0.4534 0.2043 263.56)',
  'oklch(0.38 0.165 263.4)',
  'oklch(0.3047 0.122 263.28)',
  'oklch(0.24 0.095 263)',
]

// The guidelines' third colour. Accent only: shade 7 is 4.02:1 on white, short of AA for text.
const mint: MantineColorsTuple = [
  'oklch(0.98 0.011 187)',
  'oklch(0.9629 0.0223 186.5)',
  'oklch(0.93 0.042 187)',
  'oklch(0.8678 0.0796 186.85)',
  'oklch(0.8 0.1 187)',
  'oklch(0.73 0.11 187)',
  'oklch(0.66 0.115 188)',
  'oklch(0.58 0.11 189)',
  'oklch(0.48 0.095 190)',
  'oklch(0.38 0.075 191)',
]

const fontFamily = 'Poppins, ui-sans-serif, system-ui, sans-serif'

const INPUTS = [
  'TextInput',
  'PasswordInput',
  'Textarea',
  'NumberInput',
  'Select',
  'MultiSelect',
  'TagsInput',
  'Autocomplete',
  'FileInput',
  'NativeSelect',
  'JsonInput',
] as const

const INPUT_DEFAULTS = { size: 'sm' as const }

export const theme = createTheme({
  primaryColor: 'brand',
  // Measured: shade 6 (#1346C5) is 7.75:1 on white, shade 4 is 5.5:1 on Mantine's dark body.
  primaryShade: { light: 6, dark: 4 },
  autoContrast: true,
  colors: { brand, mint },
  fontFamily,
  fontFamilyMonospace: 'ui-monospace, "JetBrains Mono", monospace',
  // The guidelines' body step is 17/20; the rest of the scale keeps its ratios to it.
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1.0625rem',
    lg: '1.25rem',
    xl: '1.5rem',
  },
  lineHeights: { xs: '1.4', sm: '1.45', md: '1.5', lg: '1.5', xl: '1.45' },
  // The 60px headline is the landing hero's; in-app the scale starts one step down.
  headings: {
    fontFamily,
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '1.875rem', lineHeight: '2rem' },
      h2: { fontSize: '1.5rem', lineHeight: '1.875rem' },
      h3: { fontSize: '1.25rem', lineHeight: '1.5rem' },
      h4: { fontSize: '1.0625rem', lineHeight: '1.25rem' },
      h5: { fontSize: '0.9375rem', lineHeight: '1.25rem' },
      h6: { fontSize: '0.875rem', lineHeight: '1.125rem' },
    },
  },
  defaultRadius: 'md',
  focusRing: 'auto',
  respectReducedMotion: true,
  cursorType: 'pointer',
  components: {
    // Every field is the same height, so a form reads as one column of controls; a dense table
    // control opts out with its own size.
    ...INPUTS.reduce(
      (registered, name) => ({ ...registered, [name]: { defaultProps: INPUT_DEFAULTS } }),
      {},
    ),
    Card: { defaultProps: { withBorder: true, radius: 'md' } },
    Paper: { defaultProps: { radius: 'md' } },
    Button: { defaultProps: { fw: 600 } },
    Title: { defaultProps: { fw: 700 } },
  },
})
