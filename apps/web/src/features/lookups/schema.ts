import { z } from 'zod'

/**
 * The curated dropdowns. A kind belongs here when its values are the company's own data —
 * something People & Culture would edit without a release.
 *
 * A value the code branches on is NOT a lookup and stays in its own union: organization and
 * portal roles are enforced by the Better Auth plugins, request and form statuses drive a
 * state machine, and a form field type selects the React control that renders it. Serving
 * those from a table would let someone add a value nothing implements.
 */
export const LOOKUP_KINDS = [
  'position',
  'employmentType',
  'clientType',
  'clientServiceLine',
  'clientSource',
  'clientCity',
  'clientState',
  'clientTag',
  'bluebookCategory',
] as const

export type LookupKind = (typeof LOOKUP_KINDS)[number]

export const LOOKUP_KIND_LABELS: Record<LookupKind, string> = {
  position: 'Positions',
  employmentType: 'Employment types',
  clientType: 'Client types',
  clientServiceLine: 'Service lines',
  clientSource: 'Client sources',
  clientCity: 'Cities',
  clientState: 'States',
  clientTag: 'Client tags',
  bluebookCategory: 'Bluebook categories',
}

export function isLookupKind(value: string): value is LookupKind {
  return (LOOKUP_KINDS as readonly string[]).includes(value)
}

export interface LookupOptionRow {
  value: string
  sortOrder: number
}

/** The values of several lists at once, which is how a screen full of dropdowns reads them. */
export type LookupOptionLists = Partial<Record<LookupKind, string[]>>

const MAX_BULK_OPTIONS = 200
const MAX_OPTION_LENGTH = 80

/**
 * Bulk insert: one pasted block becomes many options. Newlines, commas, semicolons and tabs
 * all separate, so a column copied out of a spreadsheet works without reformatting.
 */
export function parseOptionList(text: string) {
  const seen = new Set<string>()
  const values: string[] = []

  for (const raw of text.split(/[\n,;\t]/)) {
    const value = raw.trim().replace(/\s+/g, ' ')
    if (value.length === 0 || value.length > MAX_OPTION_LENGTH) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    values.push(value)
    if (values.length === MAX_BULK_OPTIONS) break
  }

  return values
}

export const OPTION_LIMITS = { maxBulk: MAX_BULK_OPTIONS, maxLength: MAX_OPTION_LENGTH } as const

export const addLookupOptionsSchema = z.object({
  kind: z.enum(LOOKUP_KINDS),
  values: z.array(z.string().trim().min(1).max(MAX_OPTION_LENGTH)).min(1).max(MAX_BULK_OPTIONS),
})

export const retireLookupOptionSchema = z.object({
  kind: z.enum(LOOKUP_KINDS),
  value: z.string().trim().min(1).max(MAX_OPTION_LENGTH),
})

export type AddLookupOptionsValues = z.infer<typeof addLookupOptionsSchema>
export type RetireLookupOptionValues = z.infer<typeof retireLookupOptionSchema>
