import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import type { InterviewContext } from './interview-notifications'
import { DEFAULT_TIME_ZONE } from './schema'
import { statusUrl } from './status-link'
import type {
  InterviewFormat,
  InterviewOffer,
  InterviewRow,
  InterviewStatus,
  Interviewer,
} from './schema'

export const INTERVIEW_INCLUDE = {
  slots: { orderBy: { start: 'asc' } },
} satisfies Prisma.InterviewInclude

export type InterviewRecord = Prisma.InterviewGetPayload<{ include: typeof INTERVIEW_INCLUDE }>

// The user table lives in another Postgres schema, so interviewers come from one lookup.
export async function interviewersById(userIds: readonly string[]) {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return new Map<string, Interviewer>()
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, preferredName: true, email: true },
  })
  return new Map(
    users.map((user) => [
      user.id,
      { userId: user.id, name: user.preferredName ?? user.name, email: user.email },
    ]),
  )
}

function slotsOf(row: InterviewRecord, now: Date) {
  // Once booked the offer is settled; while it is open, a time already past is no longer on offer.
  const open = row.status === 'offered'
  return row.slots
    .filter((slot) => !open || slot.start.getTime() > now.getTime())
    .map((slot) => ({
      id: slot.id,
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    }))
}

export function interviewRowOf(
  row: InterviewRecord,
  people: Map<string, Interviewer>,
  now = new Date(),
): InterviewRow {
  return {
    id: row.id,
    applicationId: row.applicationId,
    format: row.format as InterviewFormat,
    location: row.location,
    note: row.note,
    durationMinutes: row.durationMinutes,
    interviewers: row.interviewerIds.map(
      (id) => people.get(id) ?? { userId: id, name: 'Removed account', email: '' },
    ),
    status: row.status as InterviewStatus,
    slots: slotsOf(row, now),
    bookedStart: row.bookedStart?.toISOString(),
    bookedEnd: row.bookedEnd?.toISOString(),
    applicantTimeZone: row.applicantTimeZone ?? undefined,
    joinUrl: row.joinUrl ?? undefined,
    inCalendar: Boolean(row.calendarEventId),
    createdAt: row.createdAt.toISOString(),
  }
}

/** Every interview on an application, newest first, for HR's view of it. */
export async function interviewsOf(applicationId: string): Promise<InterviewRow[]> {
  const rows = await db.interview.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
    include: INTERVIEW_INCLUDE,
  })
  const people = await interviewersById(rows.flatMap((row) => row.interviewerIds))
  return rows.map((row) => interviewRowOf(row, people))
}

/** What the applicant may see: no interviewer names, nothing cancelled. */
export function offerOf(row: InterviewRecord, now = new Date()): InterviewOffer {
  return {
    id: row.id,
    status: row.status as InterviewStatus,
    format: row.format as InterviewFormat,
    location: row.location,
    note: row.note,
    durationMinutes: row.durationMinutes,
    slots: slotsOf(row, now),
    bookedStart: row.bookedStart?.toISOString(),
    bookedEnd: row.bookedEnd?.toISOString(),
    joinUrl: row.joinUrl ?? undefined,
  }
}

/** Everything an email or calendar invite about one interview needs, in one read. */
export async function loadInterviewContext(interviewId: string) {
  const row = await db.interview.findUnique({
    where: { id: interviewId },
    include: {
      ...INTERVIEW_INCLUDE,
      application: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          postingTitle: true,
          createdAt: true,
        },
      },
    },
  })
  if (!row) return null

  const [organization, settings, people] = await Promise.all([
    db.organization.findUnique({ where: { id: row.organizationId }, select: { name: true } }),
    db.hiringSettings.findUnique({
      where: { organizationId: row.organizationId },
      select: { timeZone: true },
    }),
    interviewersById(row.interviewerIds),
  ])

  const context: InterviewContext = {
    interviewId: row.id,
    applicationId: row.applicationId,
    organizationId: row.organizationId,
    organizationName: organization?.name ?? 'IHP+',
    timeZone: settings?.timeZone ?? DEFAULT_TIME_ZONE,
    applicant: {
      fullName: row.application.fullName,
      email: row.application.email,
      phone: row.application.phone,
    },
    postingTitle: row.application.postingTitle,
    format: row.format as InterviewFormat,
    location: row.location,
    note: row.note,
    joinUrl: row.joinUrl ?? undefined,
    interviewers: row.interviewerIds.flatMap((id) => people.get(id) ?? []),
    sequence: row.sequence,
    statusUrl: statusUrl(row.application.id, row.application.createdAt),
  }
  return { row, context }
}
