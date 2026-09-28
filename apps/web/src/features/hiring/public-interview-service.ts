import { db } from '@ihp/db'
import { z } from 'zod'
import {
  notifyInterviewBooked,
  notifyInterviewCancelled,
  notifyRescheduleRequested,
} from './interview-notifications'
import { putInCalendar, takeOutOfCalendar } from './interview-calendar'
import { INTERVIEW_INCLUDE, loadInterviewContext, offerOf } from './interviews'
import { findByLink } from './public-service'
import { bookSlotSchema, type ActionResult, type InterviewOffer } from './schema'
import { isTimeZone } from './utils/interview-time'

const BAD_LINK = 'That link is not valid.'
// A slot this close is no longer a fair offer: nobody can plan around a half-hour's notice.
const MIN_NOTICE_MS = 60 * 60 * 1000

/** The interviews an applicant can act on, newest first: open offers and booked ones. */
export async function loadInterviewOffers(applicationId: string): Promise<InterviewOffer[]> {
  const rows = await db.interview.findMany({
    where: { applicationId, status: { in: ['offered', 'booked', 'reschedule_requested'] } },
    orderBy: { createdAt: 'desc' },
    include: INTERVIEW_INCLUDE,
  })
  return rows.map((row) => offerOf(row))
}

export async function bookInterviewSlot(input: unknown): Promise<ActionResult> {
  const parsed = bookSlotSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: BAD_LINK }
  const values = parsed.data

  const application = await findByLink(values.applicationId, values.signature)
  if (!application) return { ok: false, message: BAD_LINK }
  if (application.status !== 'active') {
    return { ok: false, message: 'This application is closed, so the interview is off.' }
  }

  const slot = await db.interviewSlot.findFirst({
    where: {
      id: values.slotId,
      interviewId: values.interviewId,
      interview: { applicationId: application.id },
    },
  })
  if (!slot) return { ok: false, message: 'That time is no longer on offer.' }
  if (slot.start.getTime() - Date.now() < MIN_NOTICE_MS) {
    return { ok: false, message: 'That time has passed or is too close — pick a later one.' }
  }

  const applicantTimeZone = isTimeZone(values.timeZone) ? values.timeZone : undefined
  // Conditional on still being offered, so two tabs cannot both book one interview.
  const booked = await db.interview.updateMany({
    where: { id: values.interviewId, status: 'offered' },
    data: {
      status: 'booked',
      bookedStart: slot.start,
      bookedEnd: slot.end,
      applicantTimeZone,
      sequence: { increment: 1 },
    },
  })
  if (booked.count === 0) {
    return { ok: false, message: 'This interview is already booked or was withdrawn.' }
  }
  await db.applicationEvent.create({
    data: {
      applicationId: application.id,
      kind: 'interview_booked',
      detail: { interviewId: values.interviewId, start: slot.start.toISOString() },
    },
  })

  const loaded = await loadInterviewContext(values.interviewId)
  if (loaded) {
    // Outlook first; if it answers, its own invite goes out and ours carries no .ics.
    const event = await putInCalendar(loaded.context, { start: slot.start, end: slot.end })
    if (event) {
      await db.interview.update({
        where: { id: values.interviewId },
        data: { calendarEventId: event.id, joinUrl: event.joinUrl ?? null },
      })
    }
    notifyInterviewBooked(
      { ...loaded.context, joinUrl: event?.joinUrl ?? loaded.context.joinUrl },
      {
        start: slot.start,
        end: slot.end,
        applicantTimeZone: applicantTimeZone ?? loaded.context.timeZone,
      },
      { attachInvite: !event },
    )
  }
  return { ok: true, data: undefined }
}

const rescheduleSchema = z.object({
  applicationId: z.string().min(1).max(100),
  signature: z.string().min(1).max(200),
  interviewId: z.string().min(1).max(100),
})

/** "None of these work" on an offer, or "I can no longer make it" on a booking. */
export async function requestNewTimes(input: unknown): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: BAD_LINK }
  const values = parsed.data

  const application = await findByLink(values.applicationId, values.signature)
  if (!application) return { ok: false, message: BAD_LINK }

  const loaded = await loadInterviewContext(values.interviewId)
  if (!loaded || loaded.row.applicationId !== application.id) {
    return { ok: false, message: 'That interview is no longer there.' }
  }
  const { row, context } = loaded
  if (row.status !== 'offered' && row.status !== 'booked') {
    return { ok: false, message: 'We already know — new times are on their way.' }
  }

  const sequence = row.sequence + 1
  await db.$transaction([
    db.interview.update({
      where: { id: row.id },
      data: { status: 'reschedule_requested', sequence },
    }),
    db.applicationEvent.create({
      data: {
        applicationId: application.id,
        kind: 'interview_reschedule_requested',
        detail: { interviewId: row.id, wasBooked: row.status === 'booked' },
      },
    }),
  ])

  // A booking already sits in calendars, so it is taken back out before new times are offered.
  const outlookHandled = row.calendarEventId
    ? await takeOutOfCalendar(row.calendarEventId, 'New times are being arranged.')
    : false
  if (row.status === 'booked' && row.bookedStart && row.bookedEnd && !outlookHandled) {
    notifyInterviewCancelled(
      { ...context, sequence },
      {
        start: row.bookedStart,
        end: row.bookedEnd,
        applicantTimeZone: row.applicantTimeZone ?? context.timeZone,
      },
      { attachInvite: true },
    )
  }
  await notifyRescheduleRequested(context)
  return { ok: true, data: undefined }
}
