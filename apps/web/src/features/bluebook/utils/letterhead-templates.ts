export const LETTERHEAD_TEMPLATES = ['none', 'classic', 'minimal', 'banner'] as const
export type LetterheadTemplate = (typeof LETTERHEAD_TEMPLATES)[number]

/** Brand hex without the '#', the form both OOXML and the PDF colour helper start from. */
export const LETTERHEAD_COLORS = {
  brand: '1346C5',
  navy: '0B286B',
  mint: '95E5DC',
  ink: '222222',
  white: 'FFFFFF',
} as const

/** Every size is in points; the stampers turn them into each format's own unit. */
export interface LetterheadLayout {
  /** Space reserved at the top of every page for the letterhead. */
  headerHeight: number
  /** Space reserved at the bottom; 0 means no footer and no page numbers. */
  footerHeight: number
  logoHeight: number
  align: 'left' | 'center'
  /** A navy band behind the header, with the organization name in white. */
  band: boolean
  /** A brand-blue rule under the header. */
  rule: boolean
}

export const LETTERHEAD_LAYOUTS: Record<Exclude<LetterheadTemplate, 'none'>, LetterheadLayout> = {
  classic: {
    headerHeight: 84,
    footerHeight: 36,
    logoHeight: 44,
    align: 'left',
    band: false,
    rule: true,
  },
  minimal: {
    headerHeight: 64,
    footerHeight: 0,
    logoHeight: 36,
    align: 'center',
    band: false,
    rule: false,
  },
  banner: {
    headerHeight: 80,
    footerHeight: 32,
    logoHeight: 44,
    align: 'left',
    band: true,
    rule: false,
  },
}

export const LETTERHEAD_OPTIONS: { value: LetterheadTemplate; label: string }[] = [
  { value: 'none', label: 'No letterhead' },
  { value: 'classic', label: 'Classic — logo, name and page numbers' },
  { value: 'minimal', label: 'Minimal — centred logo only' },
  { value: 'banner', label: 'Banner — navy band with logo and name' },
]

export const LETTERHEAD_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export function supportsLetterhead(contentType: string) {
  return (LETTERHEAD_CONTENT_TYPES as readonly string[]).includes(contentType)
}
