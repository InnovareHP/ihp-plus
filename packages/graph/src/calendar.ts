import { graphJson, graphVoid, type GraphRequest } from './client'
import type { GraphConfig } from './config'

export class CalendarNotConfiguredError extends Error {
  constructor() {
    super(
      'Interview calendars are not configured — set MICROSOFT_TENANT_ID and MICROSOFT_CALENDAR_MAILBOX.',
    )
    this.name = 'CalendarNotConfiguredError'
  }
}

/**
 * Interviews are booked as the Microsoft sign-in app, called app-only, so it needs the
 * Calendars.ReadWrite application permission and a real tenant id rather than `common`.
 */
export function readCalendarConfig(): (GraphConfig & { mailbox: string }) | null {
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const secret = process.env.MICROSOFT_CLIENT_SECRET
  const mailbox = process.env.MICROSOFT_CALENDAR_MAILBOX
  // `common` works for a login, but an app-only token is issued by one tenant only.
  if (!tenantId || tenantId === 'common' || !clientId || !secret || !mailbox) return null
  return {
    tenantId,
    clientId,
    secret,
    certificate: undefined,
    internalDriveId: undefined,
    clientDriveId: undefined,
    mailbox,
  }
}

function requireCalendar() {
  const config = readCalendarConfig()
  if (!config) throw new CalendarNotConfiguredError()
  return config
}

export function requireCalendarMailbox() {
  return requireCalendar().mailbox
}

export function isCalendarConfigured() {
  return readCalendarConfig() !== null
}

/** Every calendar call goes as the sign-in app, never as the GRAPH_ drive app. */
function asCalendarApp(request: GraphRequest): GraphRequest {
  return { ...request, credential: requireCalendar() }
}

export interface CalendarAttendee {
  name: string
  email: string
}

export interface NewCalendarEvent {
  subject: string
  /** HTML; Outlook shows it as the invite's body. */
  body: string
  start: Date
  end: Date
  location: string
  attendees: readonly CalendarAttendee[]
  /** Adds a Teams meeting and returns its join link. */
  online: boolean
  /** The same value on a retry makes Graph return the event it already made, not a second one. */
  transactionId: string
}

export interface CreatedCalendarEvent {
  id: string
  joinUrl: string | undefined
}

// Graph reads a bare dateTime in the zone named beside it, so every instant goes as UTC.
function utcTime(date: Date) {
  return { dateTime: date.toISOString().replace('Z', ''), timeZone: 'UTC' }
}

/** Graph sends every attendee the invite itself, as a meeting from the mailbox. */
export async function createCalendarEvent(event: NewCalendarEvent): Promise<CreatedCalendarEvent> {
  const mailbox = requireCalendarMailbox()
  const created = await graphJson<{ id: string; onlineMeeting?: { joinUrl?: string } | null }>(
    `/users/${encodeURIComponent(mailbox)}/events`,
    asCalendarApp({
      method: 'POST',
      body: {
        subject: event.subject,
        body: { contentType: 'HTML', content: event.body },
        start: utcTime(event.start),
        end: utcTime(event.end),
        location: event.location ? { displayName: event.location } : undefined,
        attendees: event.attendees.map((person) => ({
          emailAddress: { address: person.email, name: person.name },
          type: 'required',
        })),
        allowNewTimeProposals: false,
        isOnlineMeeting: event.online,
        ...(event.online ? { onlineMeetingProvider: 'teamsForBusiness' } : {}),
        transactionId: event.transactionId,
      },
    }),
  )
  return { id: created.id, joinUrl: created.onlineMeeting?.joinUrl ?? undefined }
}

/** Cancels as the organizer, which sends every attendee the cancellation with this comment. */
export async function cancelCalendarEvent(eventId: string, comment: string) {
  const mailbox = requireCalendarMailbox()
  await graphVoid(
    `/users/${encodeURIComponent(mailbox)}/events/${encodeURIComponent(eventId)}/cancel`,
    asCalendarApp({ method: 'POST', body: { comment } }),
  )
}

export interface Availability {
  email: string
  /** One character per interval from the start: 0 free, 1 tentative, 2 busy, 3 away, 4 elsewhere. */
  view: string
}

export async function getAvailability(options: {
  emails: readonly string[]
  start: Date
  end: Date
  intervalMinutes: number
}): Promise<Availability[]> {
  const mailbox = requireCalendarMailbox()
  const response = await graphJson<{
    value: { scheduleId: string; availabilityView?: string; error?: { message?: string } }[]
  }>(
    `/users/${encodeURIComponent(mailbox)}/calendar/getSchedule`,
    asCalendarApp({
      method: 'POST',
      body: {
        schedules: options.emails,
        startTime: utcTime(options.start),
        endTime: utcTime(options.end),
        availabilityViewInterval: options.intervalMinutes,
      },
    }),
  )
  return response.value.map((schedule) => ({
    email: schedule.scheduleId,
    // A calendar Graph cannot read comes back empty; it counts as busy, never as free.
    view: schedule.error ? '' : (schedule.availabilityView ?? ''),
  }))
}

/**
 * The starts, every interval, where everyone is free for the whole length and the start is
 * one the caller accepts (working hours, a weekday). A character beyond a view's end is unknown,
 * which is treated as busy.
 */
export function commonFreeStarts(options: {
  views: readonly string[]
  start: Date
  intervalMinutes: number
  durationMinutes: number
  accept: (start: Date) => boolean
  limit: number
}): Date[] {
  const needed = Math.ceil(options.durationMinutes / options.intervalMinutes)
  const length = Math.min(...options.views.map((view) => view.length))
  const starts: Date[] = []

  for (let index = 0; index + needed <= length && starts.length < options.limit; index++) {
    const free = options.views.every((view) => {
      for (let step = index; step < index + needed; step++) {
        if (view[step] !== '0') return false
      }
      return true
    })
    if (!free) continue
    const start = new Date(options.start.getTime() + index * options.intervalMinutes * 60_000)
    if (options.accept(start)) starts.push(start)
  }
  return starts
}
