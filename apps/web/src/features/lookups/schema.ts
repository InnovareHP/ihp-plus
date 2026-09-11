/**
 * The curated dropdowns. A kind belongs here when its values are the company's own data —
 * something People & Culture would edit without a release.
 *
 * A value the code branches on is NOT a lookup and stays in its own union: organization and
 * portal roles are enforced by the Better Auth plugins, request and form statuses drive a
 * state machine, and a form field type selects the React control that renders it. Serving
 * those from a table would let someone add a value nothing implements.
 */
export const LOOKUP_KINDS = ['position', 'employmentType'] as const

export type LookupKind = (typeof LOOKUP_KINDS)[number]

export const LOOKUP_KIND_LABELS: Record<LookupKind, string> = {
  position: 'Positions',
  employmentType: 'Employment types',
}

export function isLookupKind(value: string): value is LookupKind {
  return (LOOKUP_KINDS as readonly string[]).includes(value)
}

export interface LookupOptionRow {
  value: string
  sortOrder: number
}
