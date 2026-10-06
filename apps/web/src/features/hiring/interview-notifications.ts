import {
  calendarAttachment,
  interviewBookedTemplate,
  interviewCancelledTemplate,
  interviewOfferedTemplate,
  interviewScheduledTemplate,
  portalUrl,
  rescheduleRequestedTemplate,
  sendEmail,
  type CalendarInvite,
} from '@/lib/email'
import { applicationRoute, interviewRoute } from '@/lib/routes'
import { firstNameOf, hiringAdminEmails } from './notifications'
import type { InterviewFormat, Interviewer } from './schema'
import { formatInterviewTime } from './utils/interview-time'

export interface InterviewContext {
  interviewId: string
  applicationId: string
  organizationId: string
  organizationName: string
  /** The organization's interview zone, which HR and interviewers read times in. */
  timeZone: string
  applicant: { fullName: string; email: string; phone: string }
  postingTitle: string
  format: InterviewFormat
  location: string
  note: string
  joinUrl: string | undefined
  interviewers: readonly Interviewer[]
  sequence: number
  statusUrl: string
}

function whereFor(context: InterviewContext, audience: 'applicant' | 'interviewer') {
  if (context.format === 'onsite') return `In person at ${context.location}.`
  if (context.format === 'phone') {
    if (audience === 'interviewer') {
      return context.applicant.phone
        ? `A phone call: ring ${context.applicant.fullName} on ${context.applicant.phone}.`
        : `A phone call; ${context.applicant.fullName} left no number, so reply to their email.`
    }
    return context.location ? `A phone call from ${context.location}.` : 'We will call you.'
  }
  const link = context.joinUrl ?? context.location
  return link ? `A video call: ${link}` : 'A video call; the link follows by email.'
}

// Fixed per interview, so a reschedule or a cancel replaces the invite a calendar already holds.
function uidOf(context: InterviewContext) {
  return `interview-${context.interviewId}@ihp-plus`
}

function organizer(context: InterviewContext) {
  return {
    name: `${context.organizationName} Careers`,
    email: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || 'careers@localhost',
  }
}

function invite(
  context: InterviewContext,
  booked: { start: Date; end: Date },
  method: CalendarInvite['method'],
): CalendarInvite {
  return {
    uid: uidOf(context),
    sequence: context.sequence,
    method,
    start: booked.start,
    end: booked.end,
    summary: `Interview: ${context.postingTitle}, ${context.applicant.fullName}`,
    description: [whereFor(context, 'applicant'), context.note].filter(Boolean).join('\n\n'),
    location:
      context.format === 'onsite' ? context.location : (context.joinUrl ?? context.location),
    organizer: organizer(context),
    attendees: [
      { name: context.applicant.fullName, email: context.applicant.email },
      ...context.interviewers.map((person) => ({ name: person.name, email: person.email })),
    ],
  }
}

// Every sender below is fire-and-forget: the interview is saved, and a mail outage must not undo it.
function safely(label: string, send: () => void) {
  try {
    send()
  } catch (error) {
    console.error(`[hiring] could not send ${label}`, error)
  }
}

export function notifyInterviewOffered(context: InterviewContext) {
  safely('an interview offer', () => {
    void sendEmail({
      to: context.applicant.email,
      ...interviewOfferedTemplate({
        organizationName: context.organizationName,
        firstName: firstNameOf(context.applicant.fullName),
        postingTitle: context.postingTitle,
        note: context.note,
        url: context.statusUrl,
      }),
    })
  })
}

/**
 * With Graph the calendar event itself invites everyone; without it the same meeting travels as
 * an .ics attachment, so either way it lands in their calendars.
 */
export function notifyInterviewBooked(
  context: InterviewContext,
  booked: { start: Date; end: Date; applicantTimeZone: string },
  options: { attachInvite: boolean },
) {
  const attachments = options.attachInvite
    ? [calendarAttachment(invite(context, booked, 'REQUEST'))]
    : []

  safely('a booking confirmation', () => {
    void sendEmail({
      to: context.applicant.email,
      attachments,
      ...interviewBookedTemplate({
        organizationName: context.organizationName,
        firstName: firstNameOf(context.applicant.fullName),
        postingTitle: context.postingTitle,
        when: formatInterviewTime(booked.start.toISOString(), booked.applicantTimeZone),
        where: whereFor(context, 'applicant'),
        url: context.statusUrl,
      }),
    })
  })

  const scheduled = interviewScheduledTemplate({
    applicantName: context.applicant.fullName,
    postingTitle: context.postingTitle,
    when: formatInterviewTime(booked.start.toISOString(), context.timeZone),
    where: whereFor(context, 'interviewer'),
    url: portalUrl(interviewRoute(context.interviewId)),
  })
  for (const person of context.interviewers) {
    if (!person.email) continue
    safely('an interviewer notice', () => {
      void sendEmail({ to: person.email, attachments, ...scheduled })
    })
  }
}

export function notifyInterviewCancelled(
  context: InterviewContext,
  booked: { start: Date; end: Date; applicantTimeZone: string },
  options: { attachInvite: boolean },
) {
  const attachments = options.attachInvite
    ? [calendarAttachment(invite(context, booked, 'CANCEL'))]
    : []

  const recipients = [
    {
      email: context.applicant.email,
      name: context.applicant.fullName,
      zone: booked.applicantTimeZone,
    },
    ...context.interviewers.map((person) => ({
      email: person.email,
      name: person.name,
      zone: context.timeZone,
    })),
  ]
  for (const recipient of recipients) {
    if (!recipient.email) continue
    safely('a cancellation', () => {
      void sendEmail({
        to: recipient.email,
        attachments,
        ...interviewCancelledTemplate({
          organizationName: context.organizationName,
          firstName: firstNameOf(recipient.name),
          postingTitle: context.postingTitle,
          when: formatInterviewTime(booked.start.toISOString(), recipient.zone),
        }),
      })
    })
  }
}

export async function notifyRescheduleRequested(context: InterviewContext) {
  try {
    const email = rescheduleRequestedTemplate({
      applicantName: context.applicant.fullName,
      postingTitle: context.postingTitle,
      url: portalUrl(applicationRoute(context.applicationId)),
    })
    for (const to of await hiringAdminEmails(context.organizationId))
      void sendEmail({ to, ...email })
  } catch (error) {
    console.error(`[hiring] could not tell admins about ${context.interviewId}`, error)
  }
}
