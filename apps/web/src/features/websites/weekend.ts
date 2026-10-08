import { db } from '@ihp/db'
import { portalUrl, sendEmail, websiteProblemsTemplate } from '@/lib/email'
import { routes } from '@/lib/routes'
import {
  AUTOMATIC_CHECKER_ID,
  AUTOMATIC_CHECKER_NAME,
  CHECK_ROUND_LABELS,
  CHECK_STATUS_LABELS,
  type CheckRound,
  type CheckStatus,
} from './schema'
import { runRoundFor, todayOf } from './service'
import { describeReading } from './utils/verdict'

const SATURDAY = 6
const SUNDAY = 0

export function isWeekend(dateKey: string) {
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay()
  return weekday === SATURDAY || weekday === SUNDAY
}

const dayTitle = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Owners and admins: at weekends nobody from IT is on shift, so whoever runs the company hears. */
async function adminEmails(organizationId: string) {
  const admins = await db.member.findMany({
    where: { organizationId, role: { in: ['owner', 'admin'] } },
    select: { user: { select: { email: true, banned: true } } },
  })
  return admins.filter((row) => !row.user.banned).map((row) => row.user.email)
}

async function problemsOf(organizationId: string, today: string, round: CheckRound) {
  const checks = await db.websiteCheck.findMany({
    where: {
      organizationId,
      workDate: new Date(`${today}T00:00:00.000Z`),
      round,
      status: { not: 'up' },
      website: { archivedAt: null },
    },
    select: {
      status: true,
      httpStatus: true,
      responseMs: true,
      error: true,
      note: true,
      website: { select: { name: true, url: true } },
    },
    orderBy: { website: { name: 'asc' } },
  })

  return checks.map((check) => {
    const reading = describeReading({
      httpStatus: check.httpStatus ?? undefined,
      responseMs: check.responseMs ?? undefined,
      error: check.error,
    })
    const note = check.note ? ` — ${check.note}` : ''
    const status = CHECK_STATUS_LABELS[check.status as CheckStatus] ?? check.status
    return `${check.website.name} (${check.website.url}): ${status}, ${reading}${note}`
  })
}

export interface WeekendRunSummary {
  organizations: number
  checked: number
  problems: number
  emailed: number
}

/**
 * The scheduler calls this twice a day; it only acts where it is Saturday or Sunday in the
 * company's own zone, runs that round on every site nobody checked, and emails the admins
 * the sites that are not running well.
 */
export async function runWeekendChecks(round: CheckRound): Promise<WeekendRunSummary> {
  const summary: WeekendRunSummary = { organizations: 0, checked: 0, problems: 0, emailed: 0 }
  const watching = await db.website.findMany({
    where: { archivedAt: null },
    distinct: ['organizationId'],
    select: { organizationId: true },
  })

  for (const { organizationId } of watching) {
    const today = await todayOf(organizationId)
    if (!isWeekend(today)) continue

    summary.organizations += 1
    const { checked } = await runRoundFor(
      { organizationId, userId: AUTOMATIC_CHECKER_ID, userName: AUTOMATIC_CHECKER_NAME },
      round,
      { onlyUnchecked: true },
    )
    summary.checked += checked

    const problems = await problemsOf(organizationId, today, round)
    summary.problems += problems.length
    if (problems.length === 0) continue

    const email = websiteProblemsTemplate({
      roundLabel: CHECK_ROUND_LABELS[round],
      dayLabel: dayTitle.format(new Date(`${today}T00:00:00Z`)),
      problems,
      url: portalUrl(routes.websites),
    })
    for (const to of await adminEmails(organizationId)) {
      // One failed address must not stop the rest of the admins hearing.
      try {
        const sent = await sendEmail({ to, ...email })
        if (sent.delivered) summary.emailed += 1
      } catch (error) {
        console.error('[websites] could not email a weekend alert', error)
      }
    }
  }

  return summary
}
