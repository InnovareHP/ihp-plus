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
  attendanceLeave: { findUnique: vi.fn(), findMany: vi.fn() },
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
const calendar = vi.hoisted(() => ({ fillHolidays: vi.fn(), fillUpcomingHolidays: vi.fn() }))
// The row mapping stays real; only the writes the fill makes are stood in for.
vi.mock('./holiday-calendar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./holiday-calendar')>()),
  ...calendar,
}))
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const {
  loadCalendar,
  clockIn,
  clockOut,
  deleteAttendanceDay,
  endBreak,
  loadAttendance,
  loadBoard,
  assignShift,
  deleteShift,
  deleteHoliday,
  importHolidays,
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
  sendReminders: true,
  holidayCountry: '',
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

/** A member row as the roster reads it, joined long before any range under test. */
function memberRow(userId: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    userId,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    user: { name, preferredName: null, jobTitle: null, startDate: null, banned: false },
    ...overrides,
  }
}

beforeEach(() => {
  prisma.member.findMany.mockResolvedValue([])
  prisma.attendanceSchedule.findMany.mockResolvedValue([])
  prisma.attendanceHoliday.findMany.mockResolvedValue([])
  prisma.attendanceLeave.findMany.mockResolvedValue([])
})

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
    autoClosed: false,
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
      expect.objectContaining({
        data: expect.objectContaining({ status: 'recorded', autoClosed: true }),
      }),
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
      sendReminders: true,
      holidayCountry: '',
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
      sendReminders: true,
      holidayCountry: '',
    })

    expect(saved).toMatchObject({
      id: 'shift-1',
      name: 'Morning',
      assignedCount: 0,
      requireSelfie: true,
      autoClockOutHours: 12,
      sendReminders: true,
      holidayCountry: '',
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
        sendReminders: true,
        holidayCountry: '',
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
        sendReminders: true,
        holidayCountry: '',
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
      {
        id: 'h-1',
        date: new Date('2026-12-25T00:00:00.000Z'),
        name: 'Christmas Day',
        country: '',
        source: 'manual',
      },
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
      holidays: [
        { id: 'h-1', date: '2026-12-25', name: 'Christmas Day', country: '', imported: false },
      ],
      canManage: false,
    })
  })

  it('keeps writing the calendar to an admin', async () => {
    signedInAs('member')

    await expect(
      saveHoliday({ date: '2026-12-25', name: 'Christmas Day', country: '' }),
    ).rejects.toMatchObject({
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
      country: '',
      source: 'manual',
    })

    await expect(
      saveHoliday({ date: '2026-12-25', name: 'Christmas Day', country: '' }),
    ).resolves.toEqual({
      id: 'h-1',
      date: '2026-12-25',
      name: 'Christmas Day',
      country: '',
      imported: false,
    })

    prisma.attendanceHoliday.findFirst.mockResolvedValue({ name: 'Christmas Day' })
    await expect(
      saveHoliday({ date: '2026-12-25', name: 'Xmas', country: '' }),
    ).rejects.toMatchObject({
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
    prisma.attendanceHoliday.findMany.mockResolvedValue([
      { date: new Date('2026-12-25T00:00:00.000Z'), name: 'Christmas Day', country: '' },
    ])

    const view = await loadTimeClock()

    expect(view.holidayName).toBe('Christmas Day')
    vi.useRealTimers()
  })

  it('names approved leave on the clock', async () => {
    signedInAs('member')
    vi.setSystemTime(new Date('2026-10-06T08:00:00.000Z'))
    prisma.attendanceDay.findFirst.mockResolvedValue(null)
    prisma.attendanceDay.findUnique.mockResolvedValue(null)
    prisma.attendanceHoliday.findMany.mockResolvedValue([])
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

describe('days nobody clocked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs('admin')
    everybodyOn()
    prisma.user.findMany.mockResolvedValue([])
    prisma.attendanceDay.findMany.mockResolvedValue([])
    prisma.attendanceHoliday.findMany.mockResolvedValue([])
    prisma.attendanceLeave.findMany.mockResolvedValue([])
    prisma.attendanceSchedule.findMany.mockResolvedValue([])
    // Thursday 24 September 2026; Monday the 21st to Wednesday the 23rd are settled.
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'))
  })

  it('lists a missed weekday as absent and approved leave as leave, never a holiday', async () => {
    prisma.member.findMany.mockResolvedValue([memberRow('user-2', 'Ada')])
    prisma.attendanceHoliday.findMany.mockResolvedValue([
      { date: new Date('2026-09-22T00:00:00.000Z'), name: 'Company day', country: '' },
    ])
    prisma.attendanceLeave.findMany.mockResolvedValue([
      { userId: 'user-2', date: new Date('2026-09-23T00:00:00.000Z'), name: 'Vacation leave' },
    ])

    const log = await loadAttendance({ from: '2026-09-19', to: '2026-09-24', everyone: true })

    expect(log.absences).toEqual([
      {
        userId: 'user-2',
        userName: 'Ada',
        workDate: '2026-09-23',
        kind: 'leave',
        leaveName: 'Vacation leave',
      },
      {
        userId: 'user-2',
        userName: 'Ada',
        workDate: '2026-09-21',
        kind: 'absent',
        leaveName: undefined,
      },
    ])
    vi.useRealTimers()
  })

  it('leaves a suspended account and the days before somebody started out of it', async () => {
    prisma.member.findMany.mockResolvedValue([
      memberRow('user-2', 'Ada', {
        user: {
          name: 'Ada',
          preferredName: null,
          jobTitle: null,
          startDate: new Date('2026-09-23T00:00:00.000Z'),
          banned: false,
        },
      }),
      memberRow('user-3', 'Grace', {
        user: { name: 'Grace', preferredName: null, jobTitle: null, startDate: null, banned: true },
      }),
    ])

    const log = await loadAttendance({ from: '2026-09-21', to: '2026-09-24', everyone: true })

    expect(log.absences.map((row) => `${row.userName} ${row.workDate}`)).toEqual(['Ada 2026-09-23'])
    vi.useRealTimers()
  })

  it('refuses a range that runs backwards or past a year', async () => {
    await expect(
      loadAttendance({ from: '2026-09-24', to: '2026-09-01', everyone: true }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
    await expect(
      loadAttendance({ from: '2025-01-01', to: '2026-09-01', everyone: true }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
    vi.useRealTimers()
  })

  it('closes a forgotten day on the timesheet and marks the clock-out missed', async () => {
    prisma.member.findMany.mockResolvedValue([memberRow('user-1', 'Grace')])
    prisma.attendanceDay.findMany.mockResolvedValue([dayRecord()])
    prisma.attendanceDay.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(dayRecord(data)),
    )

    const log = await loadAttendance({ from: '2026-09-22', to: '2026-09-22', everyone: true })

    expect(log.days[0]).toMatchObject({ isOpen: false, autoClosed: true })
    vi.useRealTimers()
  })

  it('stops reading as a missed clock-out once an admin corrects the day', async () => {
    prisma.attendanceDay.upsert.mockImplementation(
      ({ update }: { update: Record<string, unknown> }) => Promise.resolve(dayRecord(update)),
    )

    const day = await saveAttendanceDay({
      userId: 'user-1',
      workDate: '2026-09-22',
      clockInTime: '09:00',
      clockOutTime: '18:00',
      breakMinutes: 60,
      note: '',
    })

    expect(day.autoClosed).toBe(false)
    vi.useRealTimers()
  })

  it('tells the board why each person without a clock-in is not in', async () => {
    // 08:00 on Thursday: before the 09:00 start and its grace.
    vi.setSystemTime(new Date('2026-09-24T08:00:00.000Z'))
    prisma.member.findMany.mockResolvedValue([
      memberRow('user-2', 'Ada'),
      memberRow('user-3', 'Grace'),
      memberRow('user-4', 'Linus', { createdAt: new Date('2026-09-30T00:00:00.000Z') }),
    ])
    prisma.attendanceHoliday.findMany.mockResolvedValue([])
    prisma.attendanceLeave.findMany.mockResolvedValue([{ userId: 'user-3', name: 'Sick leave' }])

    const early = await loadBoard()
    expect(early.rows.map((row) => [row.userName, row.state, row.offReason])).toEqual([
      ['Ada', 'expected', undefined],
      ['Grace', 'leave', 'Sick leave'],
      ['Linus', 'off', undefined],
    ])
    expect(early).toMatchObject({ absentCount: 0, leaveCount: 1 })

    vi.setSystemTime(new Date('2026-09-24T10:00:00.000Z'))
    const late = await loadBoard()
    expect(late.rows[0]?.state).toBe('absent')
    expect(late.absentCount).toBe(1)

    const weekend = await loadBoard('2026-09-26')
    expect(weekend.rows[0]?.state).toBe('off')

    prisma.attendanceHoliday.findMany.mockResolvedValue([
      { date: new Date('2026-09-23T00:00:00.000Z'), name: 'Founders Day', country: '' },
    ])
    const holiday = await loadBoard('2026-09-23')
    expect(holiday.rows[0]).toMatchObject({ state: 'holiday', offReason: 'Founders Day' })

    // Another country's public holiday leaves someone on a shift without that country working.
    prisma.attendanceHoliday.findMany.mockResolvedValue([
      { date: new Date('2026-09-23T00:00:00.000Z'), name: 'Hari Raya', country: 'SG' },
    ])
    const elsewhere = await loadBoard('2026-09-23')
    expect(elsewhere.rows[0]?.state).toBe('absent')
    vi.useRealTimers()
  })
})

describe('holidays that follow the shift', () => {
  const SHIFT = {
    name: 'Manila day',
    shiftStartMinutes: 540,
    shiftEndMinutes: 1080,
    graceMinutes: 15,
    workdays: '1,2,3,4,5',
    requireSelfie: false,
    requireNote: false,
    captureLocation: false,
    autoClockOutHours: 16,
    sendReminders: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    everybodyOn()
    signedInAs('admin')
    prisma.attendanceShift.findFirst.mockResolvedValue(null)
    prisma.attendanceShift.create.mockResolvedValue({
      id: 'shift-1',
      ...SHIFT,
      holidayCountry: 'PH',
      _count: { assignments: 0 },
    })
    calendar.fillUpcomingHolidays.mockResolvedValue(40)
  })

  it('fills this year and next as soon as a shift follows a country', async () => {
    await saveShift({ ...SHIFT, holidayCountry: 'PH' })

    expect(prisma.attendanceShift.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ holidayCountry: 'PH' }) }),
    )
    expect(calendar.fillUpcomingHolidays).toHaveBeenCalledWith(expect.any(Date), 'org-1')
  })

  it('fills nothing for a shift that follows no country', async () => {
    await saveShift({ ...SHIFT, holidayCountry: '' })

    expect(calendar.fillUpcomingHolidays).not.toHaveBeenCalled()
  })

  it('keeps the shift when the fill fails, since the yearly job tries again', async () => {
    calendar.fillUpcomingHolidays.mockRejectedValue(new Error('database down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(saveShift({ ...SHIFT, holidayCountry: 'PH' })).resolves.toMatchObject({
      holidayCountry: 'PH',
    })
  })

  it('refuses a country the holiday calendar does not know', async () => {
    await expect(saveShift({ ...SHIFT, holidayCountry: 'XX' })).rejects.toMatchObject({
      code: Code.InvalidArgument,
    })
    await expect(importHolidays({ year: 2026, country: 'XX' })).rejects.toMatchObject({
      code: Code.InvalidArgument,
    })
  })

  it('fills a year on demand for an admin only', async () => {
    const rizal = {
      id: 'h-1',
      date: '2026-12-30',
      name: 'Rizal Day',
      country: 'PH',
      imported: true,
    }
    calendar.fillHolidays.mockResolvedValue([rizal])

    await expect(importHolidays({ year: 2026, country: 'ph' })).resolves.toEqual([rizal])
    expect(calendar.fillHolidays).toHaveBeenCalledWith('org-1', 'PH', 2026)

    signedInAs('member')
    await expect(importHolidays({ year: 2026, country: 'PH' })).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
  })
})

describe('the month calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    everybodyOn()
    prisma.member.findMany.mockResolvedValue([memberRow('user-1', 'Grace')])
    prisma.attendanceSchedule.findMany.mockResolvedValue([])
    prisma.attendanceHoliday.findMany.mockResolvedValue([])
    prisma.attendanceLeave.findMany.mockResolvedValue([])
    prisma.attendanceDay.findMany.mockResolvedValue([])
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', name: 'Grace Reyes', preferredName: 'Grace' },
      { id: 'user-2', name: 'Ada Lovelace', preferredName: null },
    ])
    // Thursday 24 September 2026.
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'))
  })

  it("gives every day of the month the caller's own state", async () => {
    signedInAs('member')
    prisma.attendanceDay.findMany.mockResolvedValue([
      {
        workDate: new Date('2026-09-21T00:00:00.000Z'),
        workedSeconds: 8 * 3600,
        clockOutAt: new Date('2026-09-21T18:00:00.000Z'),
      },
      { workDate: new Date('2026-09-24T00:00:00.000Z'), workedSeconds: 0, clockOutAt: null },
    ])
    prisma.attendanceHoliday.findMany.mockResolvedValue([
      { date: new Date('2026-09-22T00:00:00.000Z'), name: 'Founders Day', country: '' },
    ])
    prisma.attendanceLeave.findMany.mockResolvedValue([
      { userId: 'user-1', date: new Date('2026-09-23T00:00:00.000Z'), name: 'Vacation leave' },
    ])

    const calendar = await loadCalendar('2026-09')
    const state = (date: string) => calendar.days.find((day) => day.date === date)?.state

    expect(calendar).toMatchObject({ month: '2026-09', today: '2026-09-24', canManage: false })
    expect(calendar.days).toHaveLength(30)
    expect(state('2026-09-21')).toBe('worked')
    expect(state('2026-09-22')).toBe('holiday')
    expect(state('2026-09-23')).toBe('leave')
    expect(state('2026-09-24')).toBe('open')
    expect(state('2026-09-18')).toBe('absent')
    expect(state('2026-09-20')).toBe('off')
    expect(state('2026-09-25')).toBe('scheduled')
    expect(calendar.days.find((day) => day.date === '2026-09-23')?.leave).toEqual([
      { userId: 'user-1', userName: 'Grace', name: 'Vacation leave' },
    ])
    vi.useRealTimers()
  })

  it("shows a member only their own leave and their shift's holidays", async () => {
    signedInAs('member')
    await loadCalendar('2026-09')

    expect(prisma.attendanceLeave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
    )
    expect(prisma.attendanceHoliday.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ country: { in: ['', ''] } }),
      }),
    )
    vi.useRealTimers()
  })

  it("shows an admin every country's holidays and everyone's leave", async () => {
    signedInAs('admin')
    prisma.attendanceLeave.findMany.mockResolvedValue([
      { userId: 'user-2', date: new Date('2026-09-10T00:00:00.000Z'), name: 'Sick leave' },
    ])

    const calendar = await loadCalendar('2026-09')

    const leaveQuery = prisma.attendanceLeave.findMany.mock.calls[0]?.[0]
    expect(leaveQuery.where.userId).toBeUndefined()
    expect(prisma.attendanceHoliday.findMany.mock.calls[0]?.[0].where.country).toBeUndefined()
    expect(calendar.canManage).toBe(true)
    expect(calendar.days.find((day) => day.date === '2026-09-10')).toMatchObject({
      state: 'absent',
      leave: [{ userId: 'user-2', userName: 'Ada Lovelace', name: 'Sick leave' }],
    })
    vi.useRealTimers()
  })

  it('opens on this month in the company zone, and refuses a month that is not one', async () => {
    signedInAs('member')

    await expect(loadCalendar()).resolves.toMatchObject({ month: '2026-09' })
    await expect(loadCalendar('2026-13')).rejects.toMatchObject({ code: Code.InvalidArgument })
    vi.useRealTimers()
  })
})
