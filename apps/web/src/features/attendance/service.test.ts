import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  attendanceSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  attendanceSchedule: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  attendanceDay: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  attendanceBreak: { create: vi.fn(), update: vi.fn() },
  member: { findMany: vi.fn(), findFirst: vi.fn() },
  user: { findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))
const activity = vi.hoisted(() => ({ recordActivity: vi.fn(), loadActivity: vi.fn() }))
const storage = vi.hoisted(() => ({ objectUrl: vi.fn(), deleteObject: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/activity', () => activity)
vi.mock('@/lib/s3', () => storage)
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const {
  approveAttendanceDay,
  clockIn,
  clockOut,
  deleteAttendanceDay,
  endBreak,
  loadAttendance,
  loadBoard,
  saveAttendanceDay,
  saveAttendanceSettings,
  saveSchedule,
  startBreak,
} = await import('./service')

const RULES = {
  requireSelfie: false,
  allowManualEntry: false,
  requireNote: false,
  captureLocation: false,
  autoClockOutHours: 16,
  shiftStartMinutes: 9 * 60,
  shiftEndMinutes: 18 * 60,
  graceMinutes: 15,
  workdays: '1,2,3,4,5',
  timeZone: 'UTC',
}

function signedInAs(role: string) {
  guard.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Grace Reyes' } })
  guard.readProfile.mockResolvedValue({
    preferredName: 'Grace',
    role: 'user',
    members: [{ role, organizationId: 'org-1', organization: { id: 'org-1' } }],
    teammembers: [],
  })
}

function dayRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'day-1',
    userId: 'user-1',
    workDate: new Date('2026-09-22T00:00:00.000Z'),
    clockInAt: new Date('2026-09-22T09:00:00.000Z'),
    clockOutAt: null,
    workedSeconds: 0,
    breakSeconds: 0,
    lateSeconds: 0,
    status: 'open',
    source: 'clock',
    note: null,
    clockInSelfieKey: null,
    clockOutSelfieKey: null,
    clockInLocation: null,
    clockOutLocation: null,
    approvedById: null,
    breaks: [],
    ...overrides,
  }
}

describe('the clock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs('member')
    prisma.attendanceSettings.findUnique.mockResolvedValue(RULES)
    prisma.attendanceSchedule.findUnique.mockResolvedValue(null)
    prisma.attendanceDay.findFirst.mockResolvedValue(null)
    prisma.attendanceDay.findUnique.mockResolvedValue(null)
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', name: 'Grace Reyes', preferredName: 'Grace' },
    ])
  })

  it('opens a day and counts the lateness against the shift', async () => {
    vi.setSystemTime(new Date('2026-09-22T09:40:00.000Z'))
    prisma.attendanceDay.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(dayRecord({ lateSeconds: data.lateSeconds })),
    )

    const day = await clockIn({ selfieKey: '', location: '', note: '' })

    expect(day.isOpen).toBe(true)
    expect(day.lateSeconds).toBe(40 * 60)
    vi.useRealTimers()
  })

  it('refuses a second clock in while one is running', async () => {
    prisma.attendanceDay.findFirst.mockResolvedValue(dayRecord())

    await expect(clockIn({ selfieKey: '', location: '', note: '' })).rejects.toMatchObject({
      code: Code.FailedPrecondition,
    })
  })

  it('asks for the selfie the company requires', async () => {
    prisma.attendanceSettings.findUnique.mockResolvedValue({ ...RULES, requireSelfie: true })

    await expect(clockIn({ selfieKey: '', location: '', note: '' })).rejects.toMatchObject({
      code: Code.InvalidArgument,
    })
    expect(prisma.attendanceDay.create).not.toHaveBeenCalled()
  })

  it('asks for the note the company requires before closing the day', async () => {
    prisma.attendanceSettings.findUnique.mockResolvedValue({ ...RULES, requireNote: true })
    prisma.attendanceDay.findFirst.mockResolvedValue(dayRecord())

    await expect(clockOut({ selfieKey: '', location: '', note: '' })).rejects.toMatchObject({
      code: Code.InvalidArgument,
    })
  })

  it('closes the running break with the day and pays the difference', async () => {
    vi.setSystemTime(new Date('2026-09-22T18:00:00.000Z'))
    prisma.attendanceDay.findFirst.mockResolvedValue(
      dayRecord({
        breaks: [
          {
            id: 'break-1',
            startedAt: new Date('2026-09-22T12:00:00.000Z'),
            endedAt: null,
            seconds: 0,
          },
        ],
      }),
    )
    prisma.attendanceDay.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(dayRecord({ ...data, breaks: [] })),
    )

    const day = await clockOut({ selfieKey: '', location: '', note: 'Stock count' })

    expect(prisma.attendanceBreak.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'break-1' } }),
    )
    expect(day.breakSeconds).toBe(6 * 3600)
    expect(day.workedSeconds).toBe(3 * 3600)
    vi.useRealTimers()
  })

  it('closes a day nobody clocked out of at the hour limit', async () => {
    vi.setSystemTime(new Date('2026-09-23T09:00:00.000Z'))
    prisma.attendanceDay.findFirst.mockResolvedValue(dayRecord())
    prisma.attendanceDay.update.mockResolvedValue(
      dayRecord({ clockOutAt: new Date('2026-09-23T01:00:00.000Z'), status: 'recorded' }),
    )

    await expect(startBreak()).rejects.toMatchObject({ code: Code.FailedPrecondition })
    expect(prisma.attendanceDay.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'recorded' }) }),
    )
    vi.useRealTimers()
  })

  it('will not end a break nobody started', async () => {
    prisma.attendanceDay.findFirst.mockResolvedValue(dayRecord())

    await expect(endBreak()).rejects.toMatchObject({ code: Code.FailedPrecondition })
  })
})

describe('what only an admin may do', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs('member')
    prisma.attendanceSettings.findUnique.mockResolvedValue(RULES)
    prisma.user.findMany.mockResolvedValue([])
  })

  it('keeps the rules out of a member’s hands', async () => {
    await expect(saveAttendanceSettings(RULES)).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
  })

  it('keeps somebody else’s hours out of a member’s hands', async () => {
    await expect(
      loadAttendance({ from: '2026-09-01', to: '2026-09-22', everyone: true }),
    ).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
  })

  it('keeps the board out of a member’s hands', async () => {
    await expect(loadBoard('2026-09-22')).rejects.toMatchObject({ code: Code.PermissionDenied })
  })

  it('reads a member their own range', async () => {
    prisma.attendanceDay.findMany.mockResolvedValue([
      dayRecord({
        clockOutAt: new Date('2026-09-22T18:00:00.000Z'),
        workedSeconds: 8 * 3600,
        breakSeconds: 3600,
      }),
    ])

    const log = await loadAttendance({ from: '2026-09-01', to: '2026-09-22' })

    expect(prisma.attendanceDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
    )
    expect(log.totalWorkedSeconds).toBe(8 * 3600)
  })

  it('will not sign off a day that is still running', async () => {
    signedInAs('admin')
    prisma.attendanceDay.findFirst.mockResolvedValue({ id: 'day-1', clockOutAt: null })

    await expect(approveAttendanceDay('day-1', true)).rejects.toMatchObject({
      code: Code.FailedPrecondition,
    })
  })

  it('lets an admin set somebody a shift', async () => {
    signedInAs('admin')
    prisma.member.findFirst.mockResolvedValue({ user: { name: 'Ana Cruz', preferredName: null } })
    prisma.attendanceSchedule.upsert.mockResolvedValue({
      shiftStartMinutes: 600,
      shiftEndMinutes: 1140,
      graceMinutes: 10,
      workdays: '1,2,3,4,5,6',
    })

    const saved = await saveSchedule({
      userId: 'user-2',
      shiftStartMinutes: 600,
      shiftEndMinutes: 1140,
      graceMinutes: 10,
      workdays: '1,2,3,4,5,6',
    })

    expect(saved).toMatchObject({ userName: 'Ana Cruz', isDefault: false })
  })

  it('takes the selfies with the day it removes', async () => {
    signedInAs('admin')
    prisma.attendanceDay.findFirst.mockResolvedValue({
      id: 'day-1',
      workDate: new Date('2026-09-22T00:00:00.000Z'),
      clockInSelfieKey: 'attendance/org-1/user-1/in.jpg',
      clockOutSelfieKey: null,
    })
    prisma.attendanceDay.delete.mockResolvedValue({})

    await deleteAttendanceDay('day-1')

    expect(storage.deleteObject).toHaveBeenCalledWith('attendance/org-1/user-1/in.jpg')
    expect(storage.deleteObject).toHaveBeenCalledTimes(1)
  })

  it('puts a night shift that ends after midnight on the next date', async () => {
    signedInAs('admin')
    prisma.attendanceSettings.findUnique.mockResolvedValue({ ...RULES, timeZone: 'Asia/Manila' })
    prisma.attendanceSchedule.findUnique.mockResolvedValue(null)
    prisma.attendanceDay.upsert.mockImplementation(
      ({ create }: { create: Record<string, unknown> }) => Promise.resolve(dayRecord(create)),
    )

    const day = await saveAttendanceDay({
      userId: 'user-1',
      workDate: '2026-09-22',
      clockInTime: '22:00',
      clockOutTime: '06:00',
      breakMinutes: 60,
      note: '',
    })

    // 22:00 to 06:00 in Manila is eight hours, one of them a break.
    expect(day.workedSeconds).toBe(7 * 3600)
  })

  it('answers an unknown day with not_found rather than a silent no-op', async () => {
    signedInAs('admin')
    prisma.attendanceDay.findFirst.mockResolvedValue(null)

    await expect(approveAttendanceDay('missing', true)).rejects.toBeInstanceOf(ConnectError)
  })
})
