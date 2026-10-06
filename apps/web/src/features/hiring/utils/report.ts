import {
  ENTRY_STAGE_ID,
  type ReportFunnelStep,
  type ReportOutcomes,
  type ReportPeriod,
  type Stage,
} from '../schema'

const DAY_MS = 24 * 60 * 60 * 1000

const PERIOD_DAYS: Record<Exclude<ReportPeriod, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
}

export function reportSince(period: ReportPeriod, now: Date) {
  return period === 'all' ? undefined : new Date(now.getTime() - PERIOD_DAYS[period] * DAY_MS)
}

export interface ReportApplication {
  postingId: string
  stageId: string
  status: string
  createdAt: Date
  decidedAt: Date | null
  /** Every stage id the application was moved into, in any order. */
  movedTo: string[]
}

export interface ReportPosting {
  id: string
  stages: Stage[]
}

function median(values: number[]) {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  return sorted.length % 2 === 1 ? upper : Math.round(((sorted[middle - 1] ?? 0) + upper) / 2)
}

export function outcomesOf(applications: readonly ReportApplication[]): ReportOutcomes {
  const count = (status: string) => applications.filter((row) => row.status === status).length
  const daysToHire = applications
    .filter((row) => row.status === 'hired' && row.decidedAt)
    .map((row) => Math.round(((row.decidedAt?.getTime() ?? 0) - row.createdAt.getTime()) / DAY_MS))

  return {
    applications: applications.length,
    active: count('active'),
    hired: count('hired'),
    rejected: count('rejected'),
    withdrawn: count('withdrawn'),
    medianDaysToHire: median(daysToHire),
  }
}

/** The furthest stage an application ever stood in, since a rejection sends no one backwards. */
function furthestStage(application: ReportApplication, stages: readonly Stage[]) {
  const visited = new Set([ENTRY_STAGE_ID, application.stageId, ...application.movedTo])
  let furthest = 0
  stages.forEach((stage, index) => {
    if (visited.has(stage.id)) furthest = index
  })
  return furthest
}

/** Stages from different postings merge by name, so "Interview" counts once across all of them. */
export function funnelOf(
  applications: readonly ReportApplication[],
  postings: readonly ReportPosting[],
): ReportFunnelStep[] {
  const stagesByPosting = new Map(postings.map((posting) => [posting.id, posting.stages]))
  const steps = new Map<string, ReportFunnelStep>()

  for (const posting of postings) {
    for (const stage of posting.stages) {
      const key = stage.name.trim().toLowerCase()
      if (!steps.has(key)) steps.set(key, { name: stage.name, reached: 0 })
    }
  }

  for (const application of applications) {
    const stages = stagesByPosting.get(application.postingId)
    if (!stages) continue
    const furthest = furthestStage(application, stages)
    for (const stage of stages.slice(0, furthest + 1)) {
      const step = steps.get(stage.name.trim().toLowerCase())
      if (step) step.reached += 1
    }
  }

  const hired = applications.filter((row) => row.status === 'hired').length
  return [...steps.values(), { name: 'Hired', reached: hired }]
}

const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 })

/** Zero of zero reads as no share at all, not as a division error. */
export function shareOf(part: number, whole: number) {
  return whole > 0 ? part / whole : 0
}

export function formatShare(part: number, whole: number) {
  return percent.format(shareOf(part, whole))
}

export function formatDays(days: number | undefined) {
  if (days === undefined) return 'No hires yet'
  return days === 1 ? '1 day' : `${days} days`
}
