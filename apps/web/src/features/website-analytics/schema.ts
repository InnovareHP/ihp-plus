import { z } from 'zod'

export const TAKEAWAY_SECTIONS = [
  'observations',
  'strengths',
  'improvements',
  'recommendations',
] as const

export type TakeawaySection = (typeof TAKEAWAY_SECTIONS)[number]

export const TAKEAWAY_LABELS: Record<TakeawaySection, string> = {
  observations: 'Key observations',
  strengths: 'Strengths',
  improvements: 'Areas for improvement',
  recommendations: 'Key recommendations',
}

// Generous for a page of points, small enough that a pasted essay is caught before the PDF.
const section = z.string().max(4000, 'Keep this section under 4,000 characters.')

export const takeawaysSchema = z.object({
  observations: section,
  strengths: section,
  improvements: section,
  recommendations: section,
})

export type TakeawaysValues = z.infer<typeof takeawaysSchema>

export const EMPTY_TAKEAWAYS: TakeawaysValues = {
  observations: '',
  strengths: '',
  improvements: '',
  recommendations: '',
}

/** Saved takeaways as the screen reads them. */
export interface SavedTakeaways extends TakeawaysValues {
  updatedAt: string
}

/** One point per line; leading bullets people type are dropped, blank lines too. */
export function pointsOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
}

/** A point's short label before its first colon, which the PDF sets in bold. */
export function splitLead(point: string): { lead: string | null; rest: string } {
  const match = /^([^:]{2,60}):\s+(.+)$/.exec(point)
  return match ? { lead: match[1] ?? null, rest: match[2] ?? '' } : { lead: null, rest: point }
}

export const hasTakeaways = (values: Partial<TakeawaysValues>) =>
  TAKEAWAY_SECTIONS.some((key) => pointsOf(values[key] ?? '').length > 0)
