import {
  COMPANY_HOURS,
  isWorkday,
  minutesOfDay,
  shiftDateKey,
  workDateKey,
  zonedInstant,
} from '@ihp/clock'
import { db } from '@ihp/db'
import {
  cancelCalendarEvent,
  commonFreeStarts,
  createCalendarEvent,
  getAvailability,
  isCalendarConfigured,
} from '@ihp/graph'
import type { InterviewContext } from './interview-notifications'
import { DEFAULT_TIME_ZONE } from './schema'

const INTERVAL_MINUTES = 30
const MAX_SUGGESTIONS = 12
// A handful per day, so the offer spans several days instead of one crowded morning.
const PER_DAY = 3
const MAX_RANGE_DAYS = 14
// Suggestions start this far ahead, so nobody is offered a time they cannot plan around.
const MIN_NOTICE_MS = 24 * 60 * 60 * 1000

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Puts a booked interview into Outlook through Graph, which invites everyone itself. Null means
 * Graph is not set up or refused, and the caller falls back to emailed .ics invites.
 */
export async function putInCalendar(
  context: InterviewContext,
  booked: { start: Date; end: Date },
): Promise<{ id: string; joinUrl: string | undefined } | null> {
  if (!isCalendarConfigured()) return null

  // HR's own link wins; Teams is only added to a video call that has none.
  const online = context.format === 'video' && !context.location
  const lines = [
    `Interview for ${context.postingTitle} with ${context.applicant.fullName}.`,
    context.format === 'phone' && context.applicant.phone
      ? `Phone: ${context.applicant.phone}`
      : '',
    context.format === 'video' && context.location ? `Join: ${context.location}` : '',
    context.note,
  ].filter(Boolean)

  try {
    return await createCalendarEvent({
      subject: `Interview: ${context.postingTitle}, ${context.applicant.fullName}`,
      body: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(''),
      start: booked.start,
      end: booked.end,
      location: context.format === 'onsite' ? context.location : '',
      attendees: [
        { name: context.applicant.fullName, email: context.applicant.email },
        ...context.interviewers
          .filter((person) => person.email)
          .map((person) => ({ name: person.name, email: person.email })),
      ],
      online,
      transactionId: `interview-${context.interviewId}-${context.sequence}`,
    })
  } catch (error) {
    console.error(
      `[hiring] Graph could not book ${context.interviewId}; sending .ics instead`,
      error,
    )
    return null
  }
}

/** True when Graph took the event out and told its attendees; false means email them ourselves. */
export async function takeOutOfCalendar(eventId: string, comment: string) {
  if (!isCalendarConfigured()) return false
  try {
    await cancelCalendarEvent(eventId, comment)
    return true
  } catch (error) {
    console.error(`[hiring] Graph could not cancel event ${eventId}`, error)
    return false
  }
}

/**
 * Times every interviewer is free, within company hours on working days in the organization's
 * zone. Empty with fromCalendar false when Graph is not set up.
 */
export async function suggestInterviewTimes(input: {
  organizationId: string
  interviewerIds: readonly string[]
  durationMinutes: number
  fromDate: string
  toDate: string
}): Promise<{ starts: Date[]; fromCalendar: boolean }> {
  if (!isCalendarConfigured() || input.interviewerIds.length === 0) {
    return { starts: [], fromCalendar: false }
  }

  const [settings, people] = await Promise.all([
    db.hiringSettings.findUnique({
      where: { organizationId: input.organizationId },
      select: { timeZone: true },
    }),
    db.member.findMany({
      where: { organizationId: input.organizationId, userId: { in: [...input.interviewerIds] } },
      select: { user: { select: { email: true } } },
    }),
  ])
  const timeZone = settings?.timeZone ?? DEFAULT_TIME_ZONE
  const emails = people.map((person) => person.user.email)
  if (emails.length === 0) return { starts: [], fromCalendar: true }

  const lastDate =
    input.toDate < shiftDateKey(input.fromDate, MAX_RANGE_DAYS)
      ? input.toDate
      : shiftDateKey(input.fromDate, MAX_RANGE_DAYS)
  const windowStart = zonedInstant(input.fromDate, '00:00', timeZone)
  const windowEnd = zonedInstant(shiftDateKey(lastDate, 1), '00:00', timeZone)
  if (!windowStart || !windowEnd || windowEnd <= windowStart)
    return { starts: [], fromCalendar: true }

  const views = await getAvailability({
    emails,
    start: windowStart,
    end: windowEnd,
    intervalMinutes: INTERVAL_MINUTES,
  })
  const earliest = Date.now() + MIN_NOTICE_MS
  const lastStartMinutes = COMPANY_HOURS.shiftEndMinutes - input.durationMinutes
  const perDay = new Map<string, number>()

  const starts = commonFreeStarts({
    views: views.map((schedule) => schedule.view),
    start: windowStart,
    intervalMinutes: INTERVAL_MINUTES,
    durationMinutes: input.durationMinutes,
    limit: MAX_SUGGESTIONS,
    accept: (start) => {
      if (start.getTime() < earliest) return false
      const day = workDateKey(start, timeZone)
      if (!isWorkday(day, COMPANY_HOURS.workdays)) return false
      const minutes = minutesOfDay(start, timeZone)
      if (minutes < COMPANY_HOURS.shiftStartMinutes || minutes > lastStartMinutes) return false
      const taken = perDay.get(day) ?? 0
      if (taken >= PER_DAY) return false
      perDay.set(day, taken + 1)
      return true
    },
  })
  return { starts, fromCalendar: true }
}
