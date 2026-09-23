import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  organization: { findMany: vi.fn() },
  attendanceSettings: { findMany: vi.fn() },
  member: { findMany: vi.fn() },
  attendanceSchedule: { findMany: vi.fn() },
  attendanceHoliday: { findMany: vi.fn() },
  attendanceLeave: { findMany: vi.fn() },
  attendanceDay: { findMany: vi.fn() },
  attendanceReminder: { findMany: vi.fn(), createMany: vi.fn() },
}))
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: mail.sendEmail,
}))

const { sendDueReminders } = await import('./reminders')

// Thursday 24 September 2026, 10:00 in Manila: past a 09:00 start and its grace.
const NOW = new Date('2026-09-24T02:00:00.000Z')

describe('sendDueReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.organization.findMany.mockResolvedValue([{ id: 'org-1' }])
    prisma.attendanceSettings.findMany.mockResolvedValue([
      { organizationId: 'org-1', timeZone: 'Asia/Manila', defaultShift: null },
    ])
    prisma.member.findMany.mockResolvedValue([
      {
        organizationId: 'org-1',
        userId: 'u-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user: {
          email: 'grace@ihp.test',
          name: 'Grace Reyes',
          preferredName: null,
          startDate: null,
          banned: false,
        },
      },
      {
        organizationId: 'org-1',
        userId: 'u-2',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user: {
          email: 'ada@ihp.test',
          name: 'Ada',
          preferredName: null,
          startDate: null,
          banned: true,
        },
      },
    ])
    prisma.attendanceSchedule.findMany.mockResolvedValue([])
    prisma.attendanceHoliday.findMany.mockResolvedValue([])
    prisma.attendanceLeave.findMany.mockResolvedValue([])
    prisma.attendanceDay.findMany.mockResolvedValue([])
    prisma.attendanceReminder.findMany.mockResolvedValue([])
    prisma.attendanceReminder.createMany.mockResolvedValue({ count: 1 })
    mail.sendEmail.mockResolvedValue({ delivered: true })
  })

  it('emails someone on the company hours who has not clocked in, and nobody suspended', async () => {
    await expect(sendDueReminders(NOW)).resolves.toBe(1)

    expect(prisma.attendanceReminder.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: 'org-1',
          userId: 'u-1',
          workDate: new Date('2026-09-24T00:00:00.000Z'),
          kind: 'clock_in',
        },
      ],
      skipDuplicates: true,
    })
    expect(mail.sendEmail).toHaveBeenCalledTimes(1)
    expect(mail.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'grace@ihp.test',
        subject: 'You have not clocked in yet',
        text: expect.stringContaining('/app/attendance'),
      }),
    )
  })

  it('sends nothing a second run already claimed', async () => {
    prisma.attendanceReminder.createMany.mockResolvedValue({ count: 0 })

    await expect(sendDueReminders(NOW)).resolves.toBe(0)
    expect(mail.sendEmail).not.toHaveBeenCalled()
  })

  it('skips a reminder the log already holds', async () => {
    prisma.attendanceReminder.findMany.mockResolvedValue([
      { userId: 'u-1', workDate: new Date('2026-09-24T00:00:00.000Z'), kind: 'clock_in' },
    ])

    await sendDueReminders(NOW)

    expect(prisma.attendanceReminder.createMany).not.toHaveBeenCalled()
  })

  it('reminds someone still clocked in after their shift', async () => {
    const evening = new Date('2026-09-24T10:45:00.000Z')
    prisma.attendanceDay.findMany.mockResolvedValue([
      {
        organizationId: 'org-1',
        userId: 'u-1',
        workDate: new Date('2026-09-24T00:00:00.000Z'),
        clockInAt: new Date('2026-09-24T01:00:00.000Z'),
        clockOutAt: null,
      },
    ])

    await sendDueReminders(evening)

    expect(mail.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'You are still clocked in' }),
    )
  })
})
