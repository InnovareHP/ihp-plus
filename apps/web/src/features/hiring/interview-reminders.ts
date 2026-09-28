import { db } from '@ihp/db'
import {
  interviewReminderTemplate,
  portalUrl,
  scorecardRequestTemplate,
  sendEmail,
} from '@/lib/email'
import { interviewRoute } from '@/lib/routes'
import { loadInterviewContext } from './interviews'
import { firstNameOf } from './notifications'
import { formatInterviewTime } from './utils/interview-time'

const HOUR_MS = 60 * 60 * 1000
// The reminder goes out once the interview is a day away; booked later than that, it goes at once.
const REMIND_WITHIN_MS = 24 * HOUR_MS
// Too close to be worth a reminder: they booked it moments ago, or it is about to start.
const TOO_CLOSE_MS = 2 * HOUR_MS
const BATCH = 200

function whereLine(format: string, location: string, joinUrl: string | null) {
  if (format === 'onsite') return `In person at ${location}.`
  if (format === 'phone') return 'A phone call; we will ring the number you applied with.'
  const link = joinUrl ?? location
  return link ? `A video call: ${link}` : 'A video call; the link is in your calendar invite.'
}

/** Runs hourly; each interview is reminded once and asked for scorecards once, stamped as it goes. */
export async function sendInterviewReminders(now = new Date()) {
  const upcoming = await db.interview.findMany({
    where: {
      status: 'booked',
      reminderSentAt: null,
      bookedStart: {
        gt: new Date(now.getTime() + TOO_CLOSE_MS),
        lte: new Date(now.getTime() + REMIND_WITHIN_MS),
      },
    },
    select: { id: true },
    take: BATCH,
  })

  let reminded = 0
  for (const { id } of upcoming) {
    const loaded = await loadInterviewContext(id)
    const start = loaded?.row.bookedStart
    if (!loaded || !start) continue
    const { row, context } = loaded
    // Stamped first, so a mail outage costs one reminder rather than repeating it every hour.
    await db.interview.update({ where: { id }, data: { reminderSentAt: now } })
    void sendEmail({
      to: context.applicant.email,
      ...interviewReminderTemplate({
        firstName: firstNameOf(context.applicant.fullName),
        postingTitle: context.postingTitle,
        when: formatInterviewTime(start.toISOString(), row.applicantTimeZone ?? context.timeZone),
        where: whereLine(row.format, row.location, row.joinUrl),
        url: context.statusUrl,
      }),
    })
    reminded += 1
  }

  const finished = await db.interview.findMany({
    where: { status: 'booked', feedbackAskedAt: null, bookedEnd: { lte: now } },
    select: { id: true, interviewerIds: true, feedback: { select: { interviewerId: true } } },
    take: BATCH,
  })

  let asked = 0
  for (const interview of finished) {
    await db.interview.update({ where: { id: interview.id }, data: { feedbackAskedAt: now } })
    const done = new Set(interview.feedback.map((row) => row.interviewerId))
    const waiting = interview.interviewerIds.filter((id) => !done.has(id))
    if (waiting.length === 0) continue

    const loaded = await loadInterviewContext(interview.id)
    if (!loaded) continue
    const email = scorecardRequestTemplate({
      applicantName: loaded.context.applicant.fullName,
      postingTitle: loaded.context.postingTitle,
      url: portalUrl(interviewRoute(interview.id)),
    })
    for (const person of loaded.context.interviewers) {
      if (!waiting.includes(person.userId) || !person.email) continue
      void sendEmail({ to: person.email, ...email })
      asked += 1
    }
  }

  return { reminded, asked }
}
