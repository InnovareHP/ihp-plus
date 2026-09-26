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
  attendanceLeave: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  attendanceCorrection: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  attendanceHoliday: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  attendanceStatement: { upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  member: { findMany: vi.fn(), findFirst: vi.fn() },
  user: { findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))
const activity = vi.hoisted(() => ({ recordActivity: vi.fn(), loadActivity: vi.fn() }))
const storage = vi.hoisted(() => ({
  objectUrl: vi.fn(),
  deleteObject: vi.fn(),
  isObjectStorageConfigured: vi.fn(() => true),
}))

const mail = vi.hoisted(() => ({ notifyCorrectionDecided: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./notifications', () => mail)
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
  decideCorrection,
  loadCorrections,
  requestCorrection,
  withdrawCorrection,
  selfieKeyFor,
  loadCalendar,
  loadTeamCalendar,
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
  grantDayOff,
  revokeDayOff,
  saveBillingStatement,
  loadBillingStatements,
  deleteBillingStatement,
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
    expect(asAdmin.days[0]?.clockInSelfieUrl).toBe('/app/api/attendance/selfies/day-1?side=in')
    expect(asAdmin.days[0]?.clockOutSelfieUrl).toBeUndefined()
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
      {
        userId: 'user-2',
        date: new Date('2026-09-23T00:00:00.000Z'),
        name: 'Vacation leave',
        paid: true,
        submissionId: 'sub-1',
      },
    ])

    const log = await loadAttendance({ from: '2026-09-19', to: '2026-09-24', everyone: true })

    expect(log.absences).toEqual([
      {
        userId: 'user-2',
        userName: 'Ada',
        workDate: '2026-09-23',
        kind: 'leave',
        leaveName: 'Vacation leave',
        granted: false,
        paid: true,
      },
      {
        userId: 'user-2',
        userName: 'Ada',
        workDate: '2026-09-21',
        kind: 'absent',
        leaveName: undefined,
        granted: false,
        paid: false,
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

describe('the team calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    everybodyOn()
    prisma.member.findMany.mockResolvedValue([
      memberRow('user-2', 'Ada'),
      memberRow('user-3', 'Linus'),
    ])
    prisma.attendanceSchedule.findMany.mockResolvedValue([])
    prisma.attendanceHoliday.findMany.mockResolvedValue([])
    prisma.attendanceLeave.findMany.mockResolvedValue([])
    prisma.attendanceDay.findMany.mockResolvedValue([])
    prisma.user.findMany.mockResolvedValue([])
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'))
  })

  it('keeps the whole team out of a member’s hands, and somebody else’s month too', async () => {
    signedInAs('member')

    await expect(loadTeamCalendar('2026-09')).rejects.toMatchObject({ code: Code.PermissionDenied })
    await expect(loadCalendar('2026-09', 'user-2')).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
    vi.useRealTimers()
  })

  it('judges each person against their own shift and leaves quiet days out', async () => {
    signedInAs('admin')
    prisma.attendanceDay.findMany.mockResolvedValue([
      {
        userId: 'user-2',
        workDate: new Date('2026-09-22T00:00:00.000Z'),
        workedSeconds: 8 * 3600,
        clockOutAt: new Date('2026-09-22T18:00:00.000Z'),
      },
    ])
    prisma.attendanceLeave.findMany.mockResolvedValue([
      { userId: 'user-3', date: new Date('2026-09-23T00:00:00.000Z'), name: 'Sick leave' },
    ])

    const calendar = await loadTeamCalendar('2026-09')
    const on = (date: string) =>
      calendar.days.find((day) => day.date === date)?.people.map((one) => [one.userName, one.state])

    expect(on('2026-09-22')).toEqual([
      ['Ada', 'worked'],
      ['Linus', 'absent'],
    ])
    expect(on('2026-09-23')).toEqual([
      ['Ada', 'absent'],
      ['Linus', 'leave'],
    ])
    // A Sunday and a day still to come carry nobody.
    expect(on('2026-09-20')).toEqual([])
    expect(on('2026-09-25')).toEqual([])
    vi.useRealTimers()
  })

  it('narrows an admin’s view of one person to that person', async () => {
    signedInAs('admin')
    prisma.member.findMany.mockResolvedValue([memberRow('user-2', 'Ada')])

    const calendar = await loadCalendar('2026-09', 'user-2')

    expect(calendar.showsEveryone).toBe(false)
    expect(prisma.attendanceLeave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-2' }) }),
    )
    expect(prisma.attendanceDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-2' }) }),
    )
    vi.useRealTimers()
  })

  it('says so when the person is not in the organization', async () => {
    signedInAs('admin')
    prisma.member.findMany.mockResolvedValue([])

    await expect(loadCalendar('2026-09', 'user-9')).rejects.toMatchObject({ code: Code.NotFound })
    vi.useRealTimers()
  })
})

describe('clock selfies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    everybodyOn()
  })

  it('hands an admin the stored photo for either end of the day', async () => {
    signedInAs('admin')
    prisma.attendanceDay.findFirst.mockResolvedValue({
      clockInSelfieKey: 'attendance/org-1/user-1/in.jpg',
      clockOutSelfieKey: null,
    })

    await expect(selfieKeyFor('day-1', 'in')).resolves.toBe('attendance/org-1/user-1/in.jpg')
    await expect(selfieKeyFor('day-1', 'out')).rejects.toMatchObject({ code: Code.NotFound })
    expect(prisma.attendanceDay.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'day-1', organizationId: 'org-1' } }),
    )
  })

  it('keeps the photos out of a member’s hands, their own included', async () => {
    signedInAs('member')

    await expect(selfieKeyFor('day-1', 'in')).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
    expect(prisma.attendanceDay.findFirst).not.toHaveBeenCalled()
  })
})

describe('correction requests', () => {
  async function codeOf(operation: () => Promise<unknown>) {
    const error = await operation().catch((thrown: unknown) => thrown)
    return (error as { code?: Code }).code
  }

  const ASKED = {
    workDate: '2026-09-22',
    clockInTime: '09:00',
    clockOutTime: '18:00',
    breakMinutes: 60,
    reason: 'Forgot to clock out, left at 18:00.',
  }

  function correctionRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'corr-1',
      userId: 'user-2',
      workDate: new Date('2026-09-22T00:00:00.000Z'),
      clockInTime: '09:00',
      clockOutTime: '18:00',
      breakMinutes: 60,
      reason: 'Forgot to clock out, left at 18:00.',
      status: 'pending',
      decidedById: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: new Date('2026-09-23T00:00:00.000Z'),
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    everybodyOn()
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', name: 'Grace Reyes', preferredName: 'Grace' },
      { id: 'user-2', name: 'Ada Lovelace', preferredName: null },
    ])
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'))
  })

  it('files a member’s request for one of their own finished days', async () => {
    signedInAs('member')
    prisma.attendanceCorrection.findFirst.mockResolvedValue(null)
    prisma.attendanceCorrection.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(correctionRecord({ ...data, id: 'corr-9' })),
    )

    const row = await requestCorrection(ASKED)

    expect(prisma.attendanceCorrection.create.mock.calls[0]?.[0].data).toMatchObject({
      organizationId: 'org-1',
      userId: 'user-1',
      clockOutTime: '18:00',
    })
    expect(row).toMatchObject({ status: 'pending', isMine: true, canDecide: false })
    vi.useRealTimers()
  })

  it('refuses a day still to come, a second request for the same day, and no reason', async () => {
    signedInAs('member')

    expect(await codeOf(() => requestCorrection({ ...ASKED, workDate: '2026-09-30' }))).toBe(
      Code.InvalidArgument,
    )
    expect(await codeOf(() => requestCorrection({ ...ASKED, reason: '  ' }))).toBe(
      Code.InvalidArgument,
    )

    prisma.attendanceCorrection.findFirst.mockResolvedValue({ id: 'corr-1' })
    expect(await codeOf(() => requestCorrection(ASKED))).toBe(Code.AlreadyExists)
    expect(prisma.attendanceCorrection.create).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('shows a member only their own requests, and everyone’s only to an admin', async () => {
    signedInAs('member')
    prisma.attendanceCorrection.findMany.mockResolvedValue([])

    await loadCorrections({})
    expect(prisma.attendanceCorrection.findMany.mock.calls[0]?.[0].where).toMatchObject({
      userId: 'user-1',
    })
    expect(await codeOf(() => loadCorrections({ everyone: true }))).toBe(Code.PermissionDenied)
    vi.useRealTimers()
  })

  it('writes the day as asked when an admin approves, and tells the member', async () => {
    signedInAs('admin')
    prisma.attendanceCorrection.findFirst.mockResolvedValue(correctionRecord())
    prisma.attendanceCorrection.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(correctionRecord({ ...data, decidedById: 'user-1' })),
    )
    prisma.attendanceDay.upsert.mockImplementation(
      ({ update }: { update: Record<string, unknown> }) =>
        Promise.resolve(dayRecord({ ...update, userId: 'user-2' })),
    )

    const row = await decideCorrection({ correctionId: 'corr-1', decision: 'approved', note: '' })

    const written = prisma.attendanceDay.upsert.mock.calls[0]?.[0]
    expect(written.where).toEqual({
      userId_workDate: { userId: 'user-2', workDate: new Date('2026-09-22T00:00:00.000Z') },
    })
    expect(written.update).toMatchObject({
      clockInAt: new Date('2026-09-22T09:00:00.000Z'),
      clockOutAt: new Date('2026-09-22T18:00:00.000Z'),
      breakSeconds: 3600,
      workedSeconds: 8 * 3600,
      autoClosed: false,
      source: 'manual',
    })
    expect(row).toMatchObject({ status: 'approved', decidedBy: 'Grace' })
    expect(mail.notifyCorrectionDecided).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2', decision: 'approved', workDate: '2026-09-22' }),
    )
    vi.useRealTimers()
  })

  it('leaves the day alone when a request is turned down, which needs a reason', async () => {
    signedInAs('admin')
    prisma.attendanceCorrection.findFirst.mockResolvedValue(correctionRecord())
    prisma.attendanceCorrection.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve(correctionRecord(data)),
    )

    expect(
      await codeOf(() =>
        decideCorrection({ correctionId: 'corr-1', decision: 'rejected', note: '' }),
      ),
    ).toBe(Code.InvalidArgument)

    await decideCorrection({
      correctionId: 'corr-1',
      decision: 'rejected',
      note: 'The door log shows 17:10.',
    })
    expect(prisma.attendanceDay.upsert).not.toHaveBeenCalled()
    expect(mail.notifyCorrectionDecided).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'rejected', note: 'The door log shows 17:10.' }),
    )
    vi.useRealTimers()
  })

  it('keeps deciding to an admin, and never on a settled or an own request', async () => {
    signedInAs('member')
    expect(
      await codeOf(() =>
        decideCorrection({ correctionId: 'corr-1', decision: 'approved', note: '' }),
      ),
    ).toBe(Code.PermissionDenied)

    signedInAs('admin')
    prisma.attendanceCorrection.findFirst.mockResolvedValue(
      correctionRecord({ status: 'approved' }),
    )
    expect(
      await codeOf(() =>
        decideCorrection({ correctionId: 'corr-1', decision: 'approved', note: '' }),
      ),
    ).toBe(Code.FailedPrecondition)

    prisma.attendanceCorrection.findFirst.mockResolvedValue(correctionRecord({ userId: 'user-1' }))
    expect(
      await codeOf(() =>
        decideCorrection({ correctionId: 'corr-1', decision: 'approved', note: '' }),
      ),
    ).toBe(Code.FailedPrecondition)
    expect(prisma.attendanceDay.upsert).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('lets a member withdraw only their own pending request', async () => {
    signedInAs('member')
    prisma.attendanceCorrection.findFirst.mockResolvedValue(correctionRecord({ userId: 'user-1' }))
    prisma.attendanceCorrection.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(correctionRecord({ ...data, userId: 'user-1' })),
    )

    await expect(withdrawCorrection('corr-1')).resolves.toMatchObject({ status: 'withdrawn' })
    expect(prisma.attendanceCorrection.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      userId: 'user-1',
    })

    prisma.attendanceCorrection.findFirst.mockResolvedValue(
      correctionRecord({ userId: 'user-1', status: 'rejected' }),
    )
    expect(await codeOf(() => withdrawCorrection('corr-1'))).toBe(Code.FailedPrecondition)
    vi.useRealTimers()
  })
})

describe('a day off an admin grants', () => {
  const DAY_OFF = { userId: 'user-2', workDate: '2026-09-21' }

  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs('admin')
    prisma.member.findFirst.mockResolvedValue({ userId: 'user-2' })
    prisma.attendanceLeave.findUnique.mockResolvedValue(null)
    prisma.attendanceLeave.create.mockResolvedValue({ id: 'leave-1' })
  })

  it('books the day as paid leave for that person and records who gave it', async () => {
    await grantDayOff({ ...DAY_OFF, paid: true })

    expect(prisma.attendanceLeave.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-2',
        date: new Date('2026-09-21T00:00:00.000Z'),
        name: 'Paid day off',
        paid: true,
      },
      select: { id: true },
    })
    expect(activity.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'attendance.day_off.granted',
        detail: '2026-09-21 · paid',
      }),
    )
  })

  it('books an unpaid day off as unpaid', async () => {
    await grantDayOff({ ...DAY_OFF, paid: false })

    expect(prisma.attendanceLeave.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Unpaid day off', paid: false }),
      }),
    )
  })

  it('refuses a member, somebody outside the organization, and a day already off', async () => {
    signedInAs('member')
    await expect(grantDayOff({ ...DAY_OFF, paid: true })).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })

    signedInAs('admin')
    prisma.member.findFirst.mockResolvedValueOnce(null)
    await expect(grantDayOff({ ...DAY_OFF, paid: true })).rejects.toMatchObject({
      code: Code.NotFound,
    })

    prisma.attendanceLeave.findUnique.mockResolvedValueOnce({ name: 'Vacation leave' })
    await expect(grantDayOff({ ...DAY_OFF, paid: true })).rejects.toMatchObject({
      code: Code.AlreadyExists,
    })

    expect(prisma.attendanceLeave.create).not.toHaveBeenCalled()
  })

  it('takes back only a day an admin granted, never leave from an approved request', async () => {
    prisma.attendanceLeave.findFirst.mockResolvedValueOnce({ id: 'leave-1' })
    await revokeDayOff(DAY_OFF)

    expect(prisma.attendanceLeave.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        userId: 'user-2',
        date: new Date('2026-09-21T00:00:00.000Z'),
        submissionId: null,
      },
      select: { id: true },
    })
    expect(prisma.attendanceLeave.delete).toHaveBeenCalledWith({ where: { id: 'leave-1' } })

    prisma.attendanceLeave.findFirst.mockResolvedValueOnce(null)
    await expect(revokeDayOff(DAY_OFF)).rejects.toMatchObject({ code: Code.NotFound })
  })
})

describe('billing statements', () => {
  const STATEMENT = {
    contractorName: 'Grace Reyes',
    position: 'Virtual assistant',
    invoiceNumber: 'INV-20260930',
    invoiceDate: '2026-09-30',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    daysWorked: 20,
    hoursWorked: 160,
    dailyRateCents: 4_500,
    bonusCents: 5_000,
    expenses: [{ description: 'Internet', amountCents: 2_500 }],
    wiseLink: 'https://wise.com/pay/r/abc',
  }

  const RECORD = {
    ...STATEMENT,
    id: 'st-1',
    userId: 'user-1',
    invoiceDate: new Date('2026-09-30T00:00:00.000Z'),
    periodStart: new Date('2026-09-01T00:00:00.000Z'),
    periodEnd: new Date('2026-09-30T00:00:00.000Z'),
    totalCents: 97_500,
    createdAt: new Date('2026-09-30T08:00:00.000Z'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    signedInAs('member')
    prisma.attendanceStatement.upsert.mockResolvedValue(RECORD)
    prisma.attendanceStatement.findMany.mockResolvedValue([RECORD])
    prisma.attendanceStatement.deleteMany.mockResolvedValue({ count: 1 })
  })

  it('keeps the statement under its invoice number with a total the server works out', async () => {
    const saved = await saveBillingStatement(STATEMENT)

    const call = prisma.attendanceStatement.upsert.mock.calls[0]?.[0]
    expect(call.where).toEqual({
      userId_invoiceNumber: { userId: 'user-1', invoiceNumber: 'INV-20260930' },
    })
    expect(call.create).toMatchObject({
      organizationId: 'org-1',
      userId: 'user-1',
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      totalCents: 97_500,
    })
    expect(call.update.totalCents).toBe(97_500)
    expect(saved).toMatchObject({
      id: 'st-1',
      invoiceDate: '2026-09-30',
      periodEnd: '2026-09-30',
      expenses: [{ description: 'Internet', amountCents: 2_500 }],
    })
    expect(activity.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'attendance.statement.saved' }),
    )
  })

  it('refuses a statement without a daily rate or with a period that runs backwards', async () => {
    await expect(saveBillingStatement({ ...STATEMENT, dailyRateCents: 0 })).rejects.toMatchObject({
      code: Code.InvalidArgument,
    })
    await expect(
      saveBillingStatement({ ...STATEMENT, periodStart: '2026-10-01' }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
    expect(prisma.attendanceStatement.upsert).not.toHaveBeenCalled()
  })

  it('lists only the member’s own statements', async () => {
    const rows = await loadBillingStatements()

    expect(prisma.attendanceStatement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1', userId: 'user-1' } }),
    )
    expect(rows[0]?.createdAt).toBe('2026-09-30T08:00:00.000Z')
  })

  it('keeps an admin to their own statements too', async () => {
    signedInAs('admin')
    await loadBillingStatements()
    expect(prisma.attendanceStatement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: expect.any(String) }) }),
    )
  })

  it('deletes only the member’s own statement', async () => {
    await deleteBillingStatement('st-1')
    expect(prisma.attendanceStatement.deleteMany).toHaveBeenCalledWith({
      where: { id: 'st-1', organizationId: 'org-1', userId: 'user-1' },
    })

    prisma.attendanceStatement.deleteMany.mockResolvedValue({ count: 0 })
    await expect(deleteBillingStatement('someone-else')).rejects.toMatchObject({
      code: Code.NotFound,
    })
  })
})
