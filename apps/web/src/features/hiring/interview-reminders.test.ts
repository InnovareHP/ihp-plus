import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({ interview: { findMany: vi.fn(), update: vi.fn() } }))
const email = vi.hoisted(() => ({ sendEmail: vi.fn() }))
const interviews = vi.hoisted(() => ({ loadInterviewContext: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./interviews', () => interviews)
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: email.sendEmail,
}))

const { sendInterviewReminders } = await import('./interview-reminders')

const NOW = new Date('2026-10-13T04:00:00.000Z')
const HOUR = 60 * 60 * 1000

const CONTEXT = {
  interviewId: 'int-1',
  applicant: { fullName: 'Grace Hopper', email: 'grace@example.com', phone: '' },
  postingTitle: 'Registered nurse',
  timeZone: 'Asia/Manila',
  interviewers: [
    { userId: 'user-lead', name: 'Lee', email: 'lee@ihp.test' },
    { userId: 'user-hr', name: 'Rita', email: 'rita@ihp.test' },
  ],
  statusUrl: 'https://ihp.test/status',
}

beforeEach(() => {
  vi.clearAllMocks()
  prisma.interview.findMany.mockResolvedValue([])
})

describe('sendInterviewReminders', () => {
  it('reminds the applicant a day ahead, in their own zone, once', async () => {
    prisma.interview.findMany.mockResolvedValueOnce([{ id: 'int-1' }]).mockResolvedValueOnce([])
    interviews.loadInterviewContext.mockResolvedValue({
      row: {
        bookedStart: new Date('2026-10-14T02:00:00.000Z'),
        applicantTimeZone: 'America/Detroit',
        format: 'onsite',
        location: '12 Ayala Ave',
        joinUrl: null,
      },
      context: CONTEXT,
    })

    expect(await sendInterviewReminders(NOW)).toEqual({ reminded: 1, asked: 0 })

    const window = prisma.interview.findMany.mock.calls[0]?.[0].where
    expect(window).toMatchObject({ status: 'booked', reminderSentAt: null })
    expect(window.bookedStart.gt).toEqual(new Date(NOW.getTime() + 2 * HOUR))
    expect(window.bookedStart.lte).toEqual(new Date(NOW.getTime() + 24 * HOUR))
    expect(prisma.interview.update).toHaveBeenCalledWith({
      where: { id: 'int-1' },
      data: { reminderSentAt: NOW },
    })
    const sent = email.sendEmail.mock.calls[0]?.[0]
    expect(sent.to).toBe('grace@example.com')
    expect(sent.text).toContain('Tue, Oct 13, 10:00 PM (America/Detroit)')
    expect(sent.text).toContain('In person at 12 Ayala Ave.')
  })

  it('asks only the interviewers who have not scored an ended interview', async () => {
    prisma.interview.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'int-1',
        interviewerIds: ['user-lead', 'user-hr'],
        feedback: [{ interviewerId: 'user-hr' }],
      },
    ])
    interviews.loadInterviewContext.mockResolvedValue({ row: {}, context: CONTEXT })

    expect(await sendInterviewReminders(NOW)).toEqual({ reminded: 0, asked: 1 })

    expect(prisma.interview.update).toHaveBeenCalledWith({
      where: { id: 'int-1' },
      data: { feedbackAskedAt: NOW },
    })
    expect(email.sendEmail).toHaveBeenCalledTimes(1)
    expect(email.sendEmail.mock.calls[0]?.[0].to).toBe('lee@ihp.test')
    expect(email.sendEmail.mock.calls[0]?.[0].text).toContain('/hiring/interviews/int-1')
  })

  it('stamps an interview everyone already scored without emailing anyone', async () => {
    prisma.interview.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'int-1', interviewerIds: ['user-lead'], feedback: [{ interviewerId: 'user-lead' }] },
      ])

    expect(await sendInterviewReminders(NOW)).toEqual({ reminded: 0, asked: 0 })
    expect(prisma.interview.update).toHaveBeenCalled()
    expect(email.sendEmail).not.toHaveBeenCalled()
  })
})
