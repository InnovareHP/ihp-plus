import type { EmailAttachment } from './send'

export interface CalendarInvite {
  /** Stable across updates and the cancellation, so a calendar replaces the event it already has. */
  uid: string
  /** Raised on every change; a calendar ignores an update no newer than what it holds. */
  sequence: number
  method: 'REQUEST' | 'CANCEL'
  start: Date
  end: Date
  summary: string
  description: string
  location: string
  organizer: { name: string; email: string }
  attendees: readonly { name: string; email: string }[]
}

// RFC 5545 escapes these inside text values, and a raw newline would end the property.
function escapeText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function utc(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** Lines past 75 octets continue on the next line after a space, per RFC 5545 §3.1. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line

  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const width = new TextEncoder().encode(char).length
    const limit = parts.length === 0 ? 75 : 74
    if (size + width > limit) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += width
  }
  parts.push(current)
  return parts.join('\r\n ')
}

function person(name: string) {
  // A quoted parameter value cannot itself hold a double quote.
  return `"${name.replace(/"/g, "'")}"`
}

/** An iCalendar file Outlook, Google and Apple Calendar all open as a meeting invite. */
export function calendarInvite(invite: CalendarInvite): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//IHP+//Portal//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    `METHOD:${invite.method}`,
    'BEGIN:VEVENT',
    `UID:${invite.uid}`,
    `SEQUENCE:${invite.sequence}`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(invite.start)}`,
    `DTEND:${utc(invite.end)}`,
    `SUMMARY:${escapeText(invite.summary)}`,
    `DESCRIPTION:${escapeText(invite.description)}`,
    ...(invite.location ? [`LOCATION:${escapeText(invite.location)}`] : []),
    `STATUS:${invite.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    `ORGANIZER;CN=${person(invite.organizer.name)}:mailto:${invite.organizer.email}`,
    ...invite.attendees.map(
      (attendee) =>
        `ATTENDEE;CN=${person(attendee.name)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${attendee.email}`,
    ),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}

export function calendarAttachment(invite: CalendarInvite): EmailAttachment {
  return {
    fileName: invite.method === 'CANCEL' ? 'cancelled.ics' : 'invite.ics',
    contentType: `text/calendar; charset=UTF-8; method=${invite.method}`,
    content: calendarInvite(invite),
  }
}
