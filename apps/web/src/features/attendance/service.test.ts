import { Code } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  attendanceSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  attendanceSchedule: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  attendanceShift: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  attendanceLeave: { findUnique: vi.fn() },
  attendanceHoliday: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
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
  clockIn,
  clockOut,
  deleteAttendanceDay,
  endBreak,
  loadAttendance,
  loadBoard,
  assignShift,
  deleteShift,
  deleteHoliday,
  loadHolidays,
  loadTimeClock,
  saveHoliday,
  saveAttendanceDay,
  saveAttendanceSettings,
  saveShift,
  startBreak,
} = await import('./service')

const RULES = { timeZone: 'UTC', defaultShiftId: null }

const SHIFT = {
  id: 'shift-default',
  name: 'Company hours',
  shiftStartMinutes: 9 * 60,
  shiftEndMinutes: 18 * 60,
  graceMinutes: 15,
  workdays: '1,2,3,4,5',
  requireSelfie: false,
  requireNote: false,
  captureLocation: false,
  autoClockOutHours: 16,
}

/** Nobody has a shift of their own, so everyone falls back to the company's. */
function everybodyOn(shift: Record<string, unknown> = SHIFT) {
  prisma.attendanceSettings.findUnique.mockResolvedValue({
    timeZone: 'UTC',
    defaultShiftId: shift.id,
  })
  prisma.attendanceSchedule.findUnique.mockResolvedValue(null)
  prisma.attendanceShift.findFirst.mockResolvedValue(shift)
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
    breaks: [],
    ...overrides,
  }
}

describe('the clock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs('member')
    everybodyOn()
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
    // Pinned inside the auto-close window, or the running day is closed before the refusal.
    vi.setSystemTime(new Date('2026-09-22T10:00:00.000Z'))
    prisma.attendanceDay.findFirst.mockResolvedValue(dayRecord())

    await expect(clockIn({ selfieKey: '', location: '', note: '' })).rejects.toMatchObject({
      code: Code.FailedPrecondition,
    })
    vi.useRealTimers()
  })

  it('asks for the selfie the company requires', async () => {
    everybodyOn({ ...SHIFT, requireSelfie: true })

    await expect(clockIn({ selfieKey: '', location: '', note: '' })).rejects.toMatchObject({
      code: Code.InvalidArgument,
    })
    expect(prisma.attendanceDay.create).not.toHaveBeenCalled()
  })

  it('asks for the note the company requires before closing the day', async () => {
    everybodyOn({ ...SHIFT, requireNote: true })
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
    everybodyOn()
    prisma.user.findMany.mockResolvedValue([])
  })

  it('keeps the company settings out of a member’s hands', async () => {
    await expect(
      saveAttendanceSettings({ timeZone: 'UTC', defaultShiftId: '' }),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
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

  it('will not let a member write up their own day', async () => {
    await expect(
      saveAttendanceDay({
        userId: 'user-1',
        workDate: '2026-09-22',
        clockInTime: '09:00',
        clockOutTime: '18:00',
        breakMinutes: 60,
        note: '',
      }),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
  })

  it('keeps the selfie and the coordinates for an admin', async () => {
    storage.objectUrl.mockResolvedValue('https://example.test/selfie.jpg')
    prisma.attendanceDay.findMany.mockResolvedValue([
      dayRecord({
        clockOutAt: new Date('2026-09-22T18:00:00.000Z'),
        clockInSelfieKey: 'attendance/org-1/user-1/in.jpg',
        clockInLocation: '14.59950,120.98420',
      }),
    ])

    const asMember = await loadAttendance({ from: '2026-09-01', to: '2026-09-22' })
    expect(asMember.days[0]?.clockInSelfieUrl).toBeUndefined()
    expect(asMember.days[0]?.clockInLocation).toBeUndefined()

    signedInAs('admin')
    const asAdmin = await loadAttendance({ from: '2026-09-01', to: '2026-09-22' })
    expect(asAdmin.days[0]?.clockInSelfieUrl).toBe('https://example.test/selfie.jpg')
    expect(asAdmin.days[0]?.clockInLocation).toBe('14.59950,120.98420')
  })

  it('writes a shift once, by name', async () => {
    signedInAs('admin')
    prisma.attendanceShift.findFirst.mockResolvedValue(null)
    prisma.attendanceShift.create.mockResolvedValue({
      ...SHIFT,
      id: 'shift-1',
      name: 'Morning',
      shiftStartMinutes: 600,
      shiftEndMinutes: 1140,
      graceMinutes: 10,
      workdays: '1,2,3,4,5,6',
      requireSelfie: true,
      autoClockOutHours: 12,
      _count: { assignments: 0 },
    })

    prisma.attendanceSettings.findUnique.mockResolvedValue(RULES)

    const saved = await saveShift({
      name: 'Morning',
      shiftStartMinutes: 600,
      shiftEndMinutes: 1140,
      graceMinutes: 10,
      workdays: '1,2,3,4,5,6',
      requireSelfie: true,
      requireNote: false,
      captureLocation: false,
      autoClockOutHours: 12,
    })

    expect(saved).toMatchObject({
      id: 'shift-1',
      name: 'Morning',
      assignedCount: 0,
      requireSelfie: true,
      autoClockOutHours: 12,
    })
  })

  it('refuses a second shift with the same name', async () => {
    signedInAs('admin')
    prisma.attendanceShift.findFirst.mockResolvedValue({ id: 'shift-9' })

    await expect(
      saveShift({
        name: 'Morning',
        shiftStartMinutes: 600,
        shiftEndMinutes: 1140,
        graceMinutes: 10,
        workdays: '1,2,3,4,5',
        requireSelfie: false,
        requireNote: false,
        captureLocation: false,
        autoClockOutHours: 16,
      }),
    ).rejects.toMatchObject({ code: Code.AlreadyExists })
  })

  it('will not delete a shift people still work', async () => {
    signedInAs('admin')
    prisma.attendanceShift.findFirst.mockResolvedValue({
      id: 'shift-1',
      _count: { assignments: 3 },
    })

    await expect(deleteShift('shift-1')).rejects.toMatchObject({
      code: Code.FailedPrecondition,
    })
    expect(prisma.attendanceShift.delete).not.toHaveBeenCalled()
  })

  it('assigns a shift, and takes it back off again', async () => {
    signedInAs('admin')
    prisma.member.findFirst.mockResolvedValue({
      user: { name: 'Ana Cruz', preferredName: null, jobTitle: 'Nurse' },
    })
    prisma.attendanceShift.findFirst.mockResolvedValue({
      ...SHIFT,
      id: 'shift-1',
      name: 'Morning',
      shiftStartMinutes: 600,
      shiftEndMinutes: 1140,
      graceMinutes: 10,
      workdays: '1,2,3,4,5,6',
    })
    prisma.attendanceSchedule.upsert.mockResolvedValue({ id: 'assignment-1' })

    const assigned = await assignShift({ userId: 'user-2', shiftId: 'shift-1' })
    expect(assigned).toMatchObject({
      shiftName: 'Morning',
      isDefault: false,
      jobTitle: 'Nurse',
      shiftStartMinutes: 600,
    })

    prisma.attendanceShift.findFirst.mockResolvedValue(SHIFT)
    const cleared = await assignShift({ userId: 'user-2', shiftId: '' })

    expect(prisma.attendanceSchedule.deleteMany).toHaveBeenCalled()
    expect(cleared).toMatchObject({ isDefault: true, shiftStartMinutes: SHIFT.shiftStartMinutes })
  })

  it('keeps the shift library out of a member’s hands', async () => {
    await expect(
      saveShift({
        name: 'Morning',
        shiftStartMinutes: 600,
        shiftEndMinutes: 1140,
        graceMinutes: 10,
        workdays: '1,2,3,4,5',
        requireSelfie: false,
        requireNote: false,
        captureLocation: false,
        autoClockOutHours: 16,
      }),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    await expect(assignShift({ userId: 'user-2', shiftId: 'shift-1' })).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
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
    everybodyOn()
    prisma.attendanceSettings.findUnique.mockResolvedValue({
      timeZone: 'Asia/Manila',
      defaultShiftId: SHIFT.id,
    })
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
})

describe('the holiday calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    everybodyOn()
  })

  it('reads one year to anyone, in date order', async () => {
    signedInAs('member')
    prisma.attendanceHoliday.findMany.mockResolvedValue([
      { id: 'h-1', date: new Date('2026-12-25T00:00:00.000Z'), name: 'Christmas Day' },
    ])

    const book = await loadHolidays(2026)

    expect(prisma.attendanceHoliday.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          date: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-12-31T00:00:00.000Z'),
          },
        },
        orderBy: { date: 'asc' },
      }),
    )
    expect(book).toEqual({
      holidays: [{ id: 'h-1', date: '2026-12-25', name: 'Christmas Day' }],
      canManage: false,
    })
  })

  it('keeps writing the calendar to an admin', async () => {
    signedInAs('member')

    await expect(saveHoliday({ date: '2026-12-25', name: 'Christmas Day' })).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
    await expect(deleteHoliday('h-1')).rejects.toMatchObject({ code: Code.PermissionDenied })
  })

  it('adds a holiday, and refuses a second one on the same date', async () => {
    signedInAs('admin')
    prisma.attendanceHoliday.findFirst.mockResolvedValue(null)
    prisma.attendanceHoliday.create.mockResolvedValue({
      id: 'h-1',
      date: new Date('2026-12-25T00:00:00.000Z'),
      name: 'Christmas Day',
    })

    await expect(saveHoliday({ date: '2026-12-25', name: 'Christmas Day' })).resolves.toEqual({
      id: 'h-1',
      date: '2026-12-25',
      name: 'Christmas Day',
    })

    prisma.attendanceHoliday.findFirst.mockResolvedValue({ name: 'Christmas Day' })
    await expect(saveHoliday({ date: '2026-12-25', name: 'Xmas' })).rejects.toMatchObject({
      code: Code.AlreadyExists,
      rawMessage: '2026-12-25 is already Christmas Day.',
    })
  })

  it('says a holiday it cannot find is gone rather than pretending it deleted it', async () => {
    signedInAs('admin')
    prisma.attendanceHoliday.deleteMany.mockResolvedValue({ count: 0 })

    await expect(deleteHoliday('h-9')).rejects.toMatchObject({ code: Code.NotFound })
  })

  it('names today on the clock when it is a holiday', async () => {
    signedInAs('member')
    vi.setSystemTime(new Date('2026-12-25T08:00:00.000Z'))
    prisma.attendanceDay.findFirst.mockResolvedValue(null)
    prisma.attendanceDay.findUnique.mockResolvedValue(null)
    prisma.attendanceHoliday.findUnique.mockResolvedValue({ name: 'Christmas Day' })

    const view = await loadTimeClock()

    expect(view.holidayName).toBe('Christmas Day')
    vi.useRealTimers()
  })

  it('names approved leave on the clock', async () => {
    signedInAs('member')
    vi.setSystemTime(new Date('2026-10-06T08:00:00.000Z'))
    prisma.attendanceDay.findFirst.mockResolvedValue(null)
    prisma.attendanceDay.findUnique.mockResolvedValue(null)
    prisma.attendanceHoliday.findUnique.mockResolvedValue(null)
    prisma.attendanceLeave.findUnique.mockResolvedValue({ name: 'Vacation leave' })

    const view = await loadTimeClock()

    expect(prisma.attendanceLeave.findUnique).toHaveBeenCalledWith({
      where: { userId_date: { userId: 'user-1', date: new Date('2026-10-06T00:00:00.000Z') } },
      select: { name: true },
    })
    expect(view.leaveName).toBe('Vacation leave')
    vi.useRealTimers()
  })
})
