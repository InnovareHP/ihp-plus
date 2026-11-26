import { z } from 'zod'
import { dayKeyOf, type DayRange } from './days'
import { customRangeProblem } from './report-range'
import { reportOrganizationId } from './save'
import {
  hasTakeaways,
  TAKEAWAY_SECTIONS,
  takeawaysSchema,
  type TakeawaySection,
  type TakeawaysValues,
} from './schema'
import { saveTakeaways, siteReportFor, takeawaysFor } from './service'
import { REPORT_SITES, REPORT_TIME_ZONE, type ReportSource } from './sites'
import { ga4Facts, netlifyFacts } from './takeaway-facts'

// The column wants a user id; this marks the rows Claude Code wrote until an admin saves over them.
export const BATCH_AUTHOR = 'claude-code'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export interface SiteFacts {
  key: string
  name: string
  source: ReportSource
  /** The report as plain facts, or null when it could not be read. */
  facts: string | null
  error: string | null
  /** Takeaways are already saved, so a save leaves them alone unless asked to replace them. */
  hasSaved: boolean
}

/** Why this range cannot be reported on, or null when it can. */
export function rangeProblem(range: DayRange, now = new Date()): string | null {
  if (!DAY_KEY.test(range.start) || !DAY_KEY.test(range.end)) return 'Dates must be YYYY-MM-DD.'
  return customRangeProblem(range, dayKeyOf(now, REPORT_TIME_ZONE))
}

/** Every report site's numbers for one range, one site at a time so GA4's quota holds. */
export async function collectFacts(range: DayRange): Promise<SiteFacts[]> {
  const problem = rangeProblem(range)
  if (problem) throw new Error(problem)
  const organizationId = await reportOrganizationId()
  const sites: SiteFacts[] = []
  for (const site of REPORT_SITES) {
    const base = { key: site.key, name: site.name, source: site.source }
    const saved = await takeawaysFor(organizationId, site.key, range)
    const hasSaved = saved !== null && hasTakeaways(saved)
    try {
      const read = await siteReportFor(organizationId, site, range)
      const facts =
        read.source === 'ga4' ? ga4Facts(site, read.report) : netlifyFacts(site, read.report)
      sites.push({ ...base, facts, error: null, hasSaved })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sites.push({ ...base, facts: null, error: message, hasSaved })
    }
  }
  return sites
}

const points = z.array(z.string())

export const draftFileSchema = z.object({
  range: z.object({ start: z.string(), end: z.string() }),
  takeaways: z.record(
    z.string(),
    z.object({
      observations: points,
      strengths: points,
      improvements: points,
      recommendations: points,
    }),
  ),
})

export type DraftFile = z.infer<typeof draftFileSchema>

/** One point per line, each point kept to a single line so the PDF splits them right. */
export function valuesOf(draft: Record<TakeawaySection, string[]>): TakeawaysValues {
  const join = (lines: string[]) =>
    lines
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
  return Object.fromEntries(
    TAKEAWAY_SECTIONS.map((key) => [key, join(draft[key])]),
  ) as TakeawaysValues
}

export interface SaveOutcome {
  saved: string[]
  skipped: { site: string; reason: string }[]
}

/** Saves drafted takeaways; without write it only reports what it would do, since the target is live. */
export async function saveDrafted(
  input: unknown,
  options: { write: boolean; replace: boolean },
): Promise<SaveOutcome> {
  const parsed = draftFileSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`The takeaways file is not in the expected shape: ${parsed.error.message}`)
  }
  const { range, takeaways } = parsed.data
  const problem = rangeProblem(range)
  if (problem) throw new Error(problem)

  const organizationId = await reportOrganizationId()
  const outcome: SaveOutcome = { saved: [], skipped: [] }
  for (const [key, draft] of Object.entries(takeaways)) {
    const site = REPORT_SITES.find((one) => one.key === key)
    if (!site) {
      outcome.skipped.push({ site: key, reason: 'not on the report list' })
      continue
    }
    const values = takeawaysSchema.safeParse(valuesOf(draft))
    if (!values.success) {
      outcome.skipped.push({
        site: site.name,
        reason: values.error.issues[0]?.message ?? 'invalid',
      })
      continue
    }
    if (!hasTakeaways(values.data)) {
      outcome.skipped.push({ site: site.name, reason: 'every section is empty' })
      continue
    }
    const saved = await takeawaysFor(organizationId, site.key, range)
    if (!options.replace && saved !== null && hasTakeaways(saved)) {
      outcome.skipped.push({ site: site.name, reason: 'already has takeaways (pass --replace)' })
      continue
    }
    if (options.write) {
      await saveTakeaways(organizationId, BATCH_AUTHOR, site.key, range, values.data)
    }
    outcome.saved.push(site.name)
  }
  return outcome
}
