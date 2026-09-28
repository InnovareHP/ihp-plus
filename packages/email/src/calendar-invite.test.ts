import { describe, expect, it } from 'vitest'
import { calendarAttachment, calendarInvite, type CalendarInvite } from './calendar-invite'

const INVITE: CalendarInvite = {
  uid: 'interview-1@ihp.test',
  sequence: 0,
  method: 'REQUEST',
  start: new Date('2026-10-14T02:00:00.000Z'),
  end: new Date('2026-10-14T02:45:00.000Z'),
  summary: 'Interview: Registered nurse, Grace Hopper',
  description: 'Bring your licence.\nWe will call on arrival; ask for HR.',
  location: '12 Ayala Ave, Makati',
  organizer: { name: 'IHP+ Careers', email: 'careers@ihp.test' },
  attendees: [
    { name: 'Grace Hopper', email: 'grace@example.com' },
    { name: 'Rita "HR" Santos', email: 'rita@ihp.test' },
  ],
}

function unfold(ics: string) {
  return ics.replace(/\r\n /g, '')
}

describe('calendarInvite', () => {
  it('writes the times in UTC and every line with CRLF', () => {
    const ics = calendarInvite(INVITE)

    expect(ics).toContain('DTSTART:20261014T020000Z\r\n')
    expect(ics).toContain('DTEND:20261014T024500Z\r\n')
    expect(ics).toContain('METHOD:REQUEST\r\n')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('escapes text so a comma, semicolon or newline cannot break the file', () => {
    const ics = unfold(calendarInvite(INVITE))

    expect(ics).toContain(
      'DESCRIPTION:Bring your licence.\\nWe will call on arrival\\; ask for HR.',
    )
    expect(ics).toContain('LOCATION:12 Ayala Ave\\, Makati')
    expect(ics).toContain('SUMMARY:Interview: Registered nurse\\, Grace Hopper')
  })

  it('invites every attendee and keeps a quoted name valid', () => {
    const ics = unfold(calendarInvite(INVITE))

    expect(ics).toContain(
      'ATTENDEE;CN="Grace Hopper";ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:grace@example.com',
    )
    expect(ics).toContain('CN="Rita \'HR\' Santos"')
  })

  it('folds lines past 75 octets', () => {
    const ics = calendarInvite({ ...INVITE, description: 'x'.repeat(200) })

    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('cancels under the same uid, with a newer sequence', () => {
    const attachment = calendarAttachment({ ...INVITE, method: 'CANCEL', sequence: 1 })

    expect(attachment.contentType).toBe('text/calendar; charset=UTF-8; method=CANCEL')
    expect(attachment.content).toContain('UID:interview-1@ihp.test')
    expect(attachment.content).toContain('SEQUENCE:1')
    expect(attachment.content).toContain('STATUS:CANCELLED')
  })
})
