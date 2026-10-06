import { beforeEach, describe, expect, it, vi } from 'vitest'

const email = vi.hoisted(() => ({ sendEmail: vi.fn() }))
const team = vi.hoisted(() => ({ hiringAdminEmails: vi.fn() }))

vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: email.sendEmail,
}))
vi.mock('./notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./notifications')>()),
  hiringAdminEmails: team.hiringAdminEmails,
}))

const { notifyInterviewBooked, notifyInterviewCancelled } =
  await import('./interview-notifications')

const CONTEXT = {
  interviewId: 'int-1',
  applicationId: 'app-1',
  organizationId: 'org-1',
  organizationName: 'IHP+',
  timeZone: 'Asia/Manila',
  applicant: { fullName: 'Grace Hopper', email: 'grace@example.com', phone: '+1 555 0100' },
  postingTitle: 'Registered nurse',
  format: 'onsite' as const,
  location: '12 Ayala Ave, Makati',
  note: '',
  joinUrl: undefined,
  interviewers: [{ userId: 'user-hr', name: 'Rita', email: 'rita@ihp.test' }],
  sequence: 1,
  statusUrl: 'https://ihp.test/app/careers/status/app-1/sig',
}

const BOOKED = {
  start: new Date('2026-10-14T02:00:00.000Z'),
  end: new Date('2026-10-14T02:45:00.000Z'),
  applicantTimeZone: 'America/Detroit',
}

function sentTo(address: string) {
  return email.sendEmail.mock.calls.map((call) => call[0]).find((message) => message.to === address)
}

beforeEach(() => vi.clearAllMocks())

describe('interview emails', () => {
  it('writes the time in each reader’s own zone', () => {
    notifyInterviewBooked(CONTEXT, BOOKED, { attachInvite: true })

    expect(sentTo('grace@example.com')?.text).toContain('Tue, Oct 13, 10:00 PM (America/Detroit)')
    expect(sentTo('rita@ihp.test')?.text).toContain('Wed, Oct 14, 10:00 AM (Asia/Manila)')
  })

  it('attaches one invite for everyone when there is no Outlook event', () => {
    notifyInterviewBooked(CONTEXT, BOOKED, { attachInvite: true })

    const [invite] = sentTo('grace@example.com')?.attachments ?? []
    expect(invite.contentType).toContain('method=REQUEST')
    expect(invite.content).toContain('UID:interview-int-1@ihp-plus')
    expect(invite.content).toContain('mailto:rita@ihp.test')
    expect(sentTo('rita@ihp.test')?.attachments).toHaveLength(1)
  })

  it('sends no file when Outlook already invited everyone', () => {
    notifyInterviewBooked(CONTEXT, BOOKED, { attachInvite: false })

    expect(sentTo('grace@example.com')?.attachments).toEqual([])
  })

  it('gives interviewers the number to ring on a phone interview', () => {
    notifyInterviewBooked({ ...CONTEXT, format: 'phone', location: '' }, BOOKED, {
      attachInvite: true,
    })

    expect(sentTo('rita@ihp.test')?.text).toContain('ring Grace Hopper on +1 555 0100')
  })

  it('cancels under the same uid so calendars drop the event', () => {
    notifyInterviewCancelled({ ...CONTEXT, sequence: 2 }, BOOKED, { attachInvite: true })

    const [cancel] = sentTo('grace@example.com')?.attachments ?? []
    expect(cancel.contentType).toContain('method=CANCEL')
    expect(cancel.content).toContain('UID:interview-int-1@ihp-plus')
    expect(cancel.content).toContain('SEQUENCE:2')
  })
})
