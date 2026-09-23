import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { recordActivity } from '@/lib/activity'
import { canManageOrganization, getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { deleteObject, objectUrl } from '@/lib/s3'
import {
  assignShiftSchema,
  attendanceDaySchema,
  attendanceSettingsSchema,
  clockActionSchema,
  holidaySchema,
  DEFAULT_ATTENDANCE_SETTINGS,
  DEFAULT_SHIFT,
  shiftSchema,
  type AssignShiftValues,
  type AttendanceBoard,
  type AttendanceDayRow,
  type AttendanceDayValues,
  type AttendanceHolidayRow,
  type AttendanceLog,
  type AttendanceScheduleRow,
  type AttendanceSettingsRow,
  type AttendanceSettingsView,
  type AttendanceShiftRow,
  type AttendanceSource,
  type AttendanceState,
  type AttendanceStatus,
  type ClockActionValues,
  type HolidayBook,
  type HolidayValues,
  type ShiftValues,
  type TimeClockView,
} from './schema'
import {
  lateSecondsFor,
  shiftDateKey,
  workDateKey,
  workedSecondsFor,
  zonedInstant,
} from './utils/clock'

const SETTINGS_SELECT = { timeZone: true, defaultShiftId: true } as const

const shiftFields = {
  id: true,
  name: true,
  shiftStartMinutes: true,
  shiftEndMinutes: true,
  graceMinutes: true,
  workdays: true,
  requireSelfie: true,
  requireNote: true,
  captureLocation: true,
  autoClockOutHours: true,
} as const

async function requireMember() {
  const session = await getSession()
  if (!session) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const profile = await readProfile(session.user.id)
  if (!profile) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const membership = membershipOf(profile)
  if (!membership.organizationId) {
    throw new ConnectError('Finish setting up your profile first.', Code.FailedPrecondition)
  }

  return {
    userId: session.user.id,
    name: profile.preferredName ?? session.user.name,
    organizationId: membership.organizationId,
    // Admins are the exception throughout: the rules, other people's days, every correction.
    canManage: canManageOrganization(membership),
  }
}

type Caller = Awaited<ReturnType<typeof requireMember>>

function requireAdmin(caller: Caller, message: string) {
  if (!caller.canManage) throw new ConnectError(message, Code.PermissionDenied)
}

const daySelect = {
  id: true,
  userId: true,
  workDate: true,
  clockInAt: true,
  clockOutAt: true,
  workedSeconds: true,
  breakSeconds: true,
  lateSeconds: true,
  status: true,
  source: true,
  note: true,
  clockInSelfieKey: true,
  clockOutSelfieKey: true,
  clockInLocation: true,
  clockOutLocation: true,
  breaks: {
    select: { id: true, startedAt: true, endedAt: true, seconds: true },
    orderBy: { startedAt: 'asc' },
  },
} as const

interface BreakRecord {
  id: string
  startedAt: Date
  endedAt: Date | null
  seconds: number
}

interface DayRecord {
  id: string
  userId: string
  workDate: Date
  clockInAt: Date
  clockOutAt: Date | null
  workedSeconds: number
  breakSeconds: number
  lateSeconds: number
  status: string
  source: string
  note: string | null
  clockInSelfieKey: string | null
  clockOutSelfieKey: string | null
  clockInLocation: string | null
  clockOutLocation: string | null
  breaks: BreakRecord[]
}

export async function settingsOf(organizationId: string): Promise<AttendanceSettingsRow> {
  const stored = await db.attendanceSettings.findUnique({
    where: { organizationId },
    select: SETTINGS_SELECT,
  })
  if (!stored) return DEFAULT_ATTENDANCE_SETTINGS

  return { timeZone: stored.timeZone, defaultShiftId: stored.defaultShiftId ?? '' }
}

interface ShiftFields {
  id: string
  name: string
  shiftStartMinutes: number
  shiftEndMinutes: number
  graceMinutes: number
  workdays: string
  requireSelfie: boolean
  requireNote: boolean
  captureLocation: boolean
  autoClockOutHours: number
}

function toShiftFields(shift: ShiftFields, assignedCount: number, isDefault: boolean) {
  return { ...shift, assignedCount, isDefault }
}

/**
 * The shift somebody is measured against: the one they were given, else the company's default,
 * else the built-in hours. Its rules are the clock's rules — selfie, note, location, auto-close.
 */
async function shiftFor(
  organizationId: string,
  userId: string,
  settings: AttendanceSettingsRow,
): Promise<AttendanceShiftRow> {
  const assignment = await db.attendanceSchedule.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { shift: { select: shiftFields } },
  })
  if (assignment) return toShiftFields(assignment.shift, 0, false)

  return defaultShiftOf(organizationId, settings)
}

async function defaultShiftOf(
  organizationId: string,
  settings: AttendanceSettingsRow,
): Promise<AttendanceShiftRow> {
  if (!settings.defaultShiftId) return DEFAULT_SHIFT

  const shift = await db.attendanceShift.findFirst({
    where: { id: settings.defaultShiftId, organizationId },
    select: shiftFields,
  })

  // A default that was deleted leaves the built-in hours standing rather than no rules at all.
  return shift ? toShiftFields(shift, 0, true) : DEFAULT_SHIFT
}

async function peopleNames(ids: readonly string[]) {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return new Map<string, string>()

  const people = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, preferredName: true },
  })

  return new Map(people.map((person) => [person.id, person.preferredName ?? person.name]))
}

/** Storage failing must not strand a delete the database has already accepted. */
async function forgetSelfies(keys: readonly (string | null)[]) {
  for (const key of keys.filter((one): one is string => Boolean(one))) {
    try {
      await deleteObject(key)
    } catch {
      // The row is gone either way; an unreachable bucket must not fail the delete.
    }
  }
}

// Storage being unconfigured must not blank the row: the day still reads, the photo just cannot
// be opened.
async function signedUrl(key: string | null) {
  if (!key) return undefined
  try {
    return await objectUrl(key)
  } catch {
    return undefined
  }
}

function statusOf(value: string): AttendanceStatus {
  return value === 'open' ? 'open' : 'recorded'
}

function sourceOf(value: string): AttendanceSource {
  return value === 'manual' ? 'manual' : 'clock'
}

function dateKeyOf(workDate: Date) {
  return workDate.toISOString().slice(0, 10)
}

function dateOf(workDate: string) {
  return new Date(`${workDate}T00:00:00.000Z`)
}

/**
 * Photos and coordinates are what the clock collects about a person, so only an admin is handed
 * them — a member reads their own hours, not the evidence behind them.
 */
async function toDayRow(
  day: DayRecord,
  names: Map<string, string>,
  viewer: Caller,
): Promise<AttendanceDayRow> {
  const [clockInSelfieUrl, clockOutSelfieUrl] = viewer.canManage
    ? await Promise.all([signedUrl(day.clockInSelfieKey), signedUrl(day.clockOutSelfieKey)])
    : [undefined, undefined]

  return {
    id: day.id,
    userId: day.userId,
    userName: names.get(day.userId) ?? 'Someone',
    workDate: dateKeyOf(day.workDate),
    clockInAt: day.clockInAt.toISOString(),
    clockOutAt: day.clockOutAt?.toISOString(),
    workedSeconds: day.workedSeconds,
    breakSeconds: day.breakSeconds,
    lateSeconds: day.lateSeconds,
    status: statusOf(day.status),
    source: sourceOf(day.source),
    note: day.note ?? undefined,
    clockInSelfieUrl,
    clockOutSelfieUrl,
    clockInLocation: viewer.canManage ? (day.clockInLocation ?? undefined) : undefined,
    clockOutLocation: viewer.canManage ? (day.clockOutLocation ?? undefined) : undefined,
    isOpen: day.clockOutAt === null,
    onBreak: day.breaks.some((one) => one.endedAt === null),
    breaks: day.breaks.map((one) => ({
      id: one.id,
      startedAt: one.startedAt.toISOString(),
      endedAt: one.endedAt?.toISOString(),
      seconds: one.seconds,
      isRunning: one.endedAt === null,
    })),
  }
}

async function rowsFor(days: DayRecord[], viewer: Caller): Promise<AttendanceDayRow[]> {
  const names = await peopleNames(days.map((day) => day.userId))
  return Promise.all(days.map((day) => toDayRow(day, names, viewer)))
}

function breakSecondsOf(day: DayRecord, until: Date) {
  return day.breaks.reduce((total, one) => {
    if (one.endedAt) return total + one.seconds
    return total + Math.max(Math.floor((until.getTime() - one.startedAt.getTime()) / 1000), 0)
  }, 0)
}

async function closeBreaks(breaks: BreakRecord[], endedAt: Date) {
  const running = breaks.filter((one) => one.endedAt === null)
  await Promise.all(
    running.map((one) =>
      db.attendanceBreak.update({
        where: { id: one.id },
        data: {
          endedAt,
          seconds: Math.max(Math.floor((endedAt.getTime() - one.startedAt.getTime()) / 1000), 0),
        },
      }),
    ),
  )
}

/**
 * A day nobody clocked out of is closed at the limit rather than left to grow overnight; the cap
 * is applied on the way past, so no scheduled job is needed to keep the numbers honest.
 */
async function closeForgottenDay(day: DayRecord, hours: number): Promise<DayRecord> {
  if (day.clockOutAt !== null || hours <= 0) return day

  const limit = hours * 3600
  const ran = Math.floor((Date.now() - day.clockInAt.getTime()) / 1000)
  if (ran < limit) return day

  const clockOutAt = new Date(day.clockInAt.getTime() + limit * 1000)
  await closeBreaks(day.breaks, clockOutAt)
  const breakSeconds = breakSecondsOf(day, clockOutAt)

  return db.attendanceDay.update({
    where: { id: day.id },
    data: {
      clockOutAt,
      breakSeconds,
      workedSeconds: workedSecondsFor(day.clockInAt, clockOutAt, breakSeconds),
      status: 'recorded',
      note: day.note ?? 'Closed automatically.',
    },
    select: daySelect,
  })
}

async function openDayOf(caller: Caller, shift: AttendanceShiftRow) {
  const open = await db.attendanceDay.findFirst({
    where: { userId: caller.userId, organizationId: caller.organizationId, clockOutAt: null },
    select: daySelect,
    orderBy: { clockInAt: 'desc' },
  })
  if (!open) return null

  const settled = await closeForgottenDay(open, shift.autoClockOutHours)
  return settled.clockOutAt === null ? settled : null
}

function scheduleFrom(
  userId: string,
  userName: string,
  shift: AttendanceShiftRow,
  assigned: boolean,
): AttendanceScheduleRow {
  return {
    userId,
    userName,
    shiftStartMinutes: shift.shiftStartMinutes,
    shiftEndMinutes: shift.shiftEndMinutes,
    graceMinutes: shift.graceMinutes,
    workdays: shift.workdays,
    isDefault: !assigned,
    shiftId: assigned ? shift.id : undefined,
    shiftName: assigned ? shift.name : undefined,
    jobTitle: undefined,
  }
}

export async function loadAttendanceSettings(): Promise<AttendanceSettingsView> {
  const caller = await requireMember()
  return { settings: await settingsOf(caller.organizationId), canManage: caller.canManage }
}

export async function saveAttendanceSettings(
  values: AttendanceSettingsRow,
): Promise<AttendanceSettingsRow> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets the attendance rules.')

  const parsed = attendanceSettingsSchema.parse(values)

  if (parsed.defaultShiftId) {
    const shift = await db.attendanceShift.findFirst({
      where: { id: parsed.defaultShiftId, organizationId: caller.organizationId },
      select: { id: true },
    })
    if (!shift) throw new ConnectError('That shift is no longer there.', Code.NotFound)
  }

  const data = { timeZone: parsed.timeZone, defaultShiftId: parsed.defaultShiftId || null }
  const saved = await db.attendanceSettings.upsert({
    where: { organizationId: caller.organizationId },
    create: { organizationId: caller.organizationId, ...data },
    update: data,
    select: SETTINGS_SELECT,
  })

  return { timeZone: saved.timeZone, defaultShiftId: saved.defaultShiftId ?? '' }
}

export async function loadTimeClock(): Promise<TimeClockView> {
  const caller = await requireMember()
  const settings = await settingsOf(caller.organizationId)
  const shift = await shiftFor(caller.organizationId, caller.userId, settings)
  const open = await openDayOf(caller, shift)

  // A day already closed is still today's row: the screen shows the hours, not a fresh clock.
  const today =
    open ??
    (await db.attendanceDay.findUnique({
      where: {
        userId_workDate: {
          userId: caller.userId,
          workDate: dateOf(workDateKey(new Date(), settings.timeZone)),
        },
      },
      select: daySelect,
    }))

  const names = new Map([[caller.userId, caller.name]])
  const todayKey = dateOf(workDateKey(new Date(), settings.timeZone))
  const [holiday, leave] = await Promise.all([
    db.attendanceHoliday.findUnique({
      where: {
        organizationId_date: { organizationId: caller.organizationId, date: todayKey },
      },
      select: { name: true },
    }),
    db.attendanceLeave.findUnique({
      where: { userId_date: { userId: caller.userId, date: todayKey } },
      select: { name: true },
    }),
  ])

  return {
    today: today ? await toDayRow(today, names, caller) : undefined,
    settings,
    schedule: scheduleFrom(
      caller.userId,
      caller.name,
      shift,
      !shift.isDefault && Boolean(shift.id),
    ),
    canManage: caller.canManage,
    shift,
    holidayName: holiday?.name,
    leaveName: leave?.name,
  }
}

function checkedClockValues(values: ClockActionValues, shift: AttendanceShiftRow) {
  const parsed = clockActionSchema.parse(values)
  if (shift.requireSelfie && !parsed.selfieKey) {
    throw new ConnectError('Your shift asks for a selfie at the clock.', Code.InvalidArgument)
  }
  return parsed
}

export async function clockIn(values: ClockActionValues): Promise<AttendanceDayRow> {
  const caller = await requireMember()
  const settings = await settingsOf(caller.organizationId)
  const shift = await shiftFor(caller.organizationId, caller.userId, settings)
  const parsed = checkedClockValues(values, shift)

  const open = await openDayOf(caller, shift)
  if (open) throw new ConnectError('You are already clocked in.', Code.FailedPrecondition)

  const clockInAt = new Date()
  const workDate = workDateKey(clockInAt, settings.timeZone)
  const already = await db.attendanceDay.findUnique({
    where: { userId_workDate: { userId: caller.userId, workDate: dateOf(workDate) } },
    select: { id: true },
  })
  if (already) {
    throw new ConnectError(
      'Today is already recorded — ask an admin to correct it.',
      Code.FailedPrecondition,
    )
  }

  const day = await db.attendanceDay.create({
    data: {
      organizationId: caller.organizationId,
      userId: caller.userId,
      workDate: dateOf(workDate),
      clockInAt,
      status: 'open',
      source: 'clock',
      note: parsed.note || null,
      clockInSelfieKey: parsed.selfieKey || null,
      clockInLocation: parsed.location || null,
      lateSeconds: lateSecondsFor({
        clockInAt,
        shiftStartMinutes: shift.shiftStartMinutes,
        graceMinutes: shift.graceMinutes,
        timeZone: settings.timeZone,
      }),
    },
    select: daySelect,
  })

  return toDayRow(day, new Map([[caller.userId, caller.name]]), caller)
}

export async function clockOut(values: ClockActionValues): Promise<AttendanceDayRow> {
  const caller = await requireMember()
  const settings = await settingsOf(caller.organizationId)
  const shift = await shiftFor(caller.organizationId, caller.userId, settings)
  const parsed = checkedClockValues(values, shift)
  if (shift.requireNote && !parsed.note) {
    throw new ConnectError('Your shift asks what you worked on today.', Code.InvalidArgument)
  }

  const open = await openDayOf(caller, shift)
  if (!open) throw new ConnectError('You are not clocked in.', Code.FailedPrecondition)

  const clockOutAt = new Date()
  await closeBreaks(open.breaks, clockOutAt)
  const breakSeconds = breakSecondsOf(open, clockOutAt)

  const day = await db.attendanceDay.update({
    where: { id: open.id },
    data: {
      clockOutAt,
      breakSeconds,
      workedSeconds: workedSecondsFor(open.clockInAt, clockOutAt, breakSeconds),
      status: 'recorded',
      note: parsed.note || open.note,
      clockOutSelfieKey: parsed.selfieKey || null,
      clockOutLocation: parsed.location || null,
    },
    select: daySelect,
  })

  return toDayRow(day, new Map([[caller.userId, caller.name]]), caller)
}

export async function startBreak(): Promise<AttendanceDayRow> {
  const caller = await requireMember()
  const settings = await settingsOf(caller.organizationId)
  const shift = await shiftFor(caller.organizationId, caller.userId, settings)

  const open = await openDayOf(caller, shift)
  if (!open) throw new ConnectError('Clock in before taking a break.', Code.FailedPrecondition)
  if (open.breaks.some((one) => one.endedAt === null)) {
    throw new ConnectError('You are already on a break.', Code.FailedPrecondition)
  }

  await db.attendanceBreak.create({ data: { dayId: open.id, startedAt: new Date() } })

  const day = await db.attendanceDay.findUniqueOrThrow({
    where: { id: open.id },
    select: daySelect,
  })
  return toDayRow(day, new Map([[caller.userId, caller.name]]), caller)
}

export async function endBreak(): Promise<AttendanceDayRow> {
  const caller = await requireMember()
  const settings = await settingsOf(caller.organizationId)
  const shift = await shiftFor(caller.organizationId, caller.userId, settings)

  const open = await openDayOf(caller, shift)
  if (!open) throw new ConnectError('You are not clocked in.', Code.FailedPrecondition)
  if (!open.breaks.some((one) => one.endedAt === null)) {
    throw new ConnectError('You are not on a break.', Code.FailedPrecondition)
  }

  const endedAt = new Date()
  await closeBreaks(open.breaks, endedAt)

  const day = await db.attendanceDay.update({
    where: { id: open.id },
    data: { breakSeconds: breakSecondsOf(open, endedAt) },
    select: daySelect,
  })

  return toDayRow(day, new Map([[caller.userId, caller.name]]), caller)
}

export interface AttendanceQuery {
  from: string
  to: string
  userId?: string
  everyone?: boolean
}

export async function loadAttendance(query: AttendanceQuery): Promise<AttendanceLog> {
  const caller = await requireMember()
  const somebodyElse = Boolean(query.everyone || (query.userId && query.userId !== caller.userId))
  if (somebodyElse) requireAdmin(caller, 'Only an admin reads other people’s hours.')

  const days = await db.attendanceDay.findMany({
    where: {
      organizationId: caller.organizationId,
      ...(query.everyone ? {} : { userId: query.userId || caller.userId }),
      workDate: { gte: dateOf(query.from), lte: dateOf(query.to) },
    },
    select: daySelect,
    orderBy: [{ workDate: 'desc' }, { clockInAt: 'desc' }],
  })

  const rows = await rowsFor(days, caller)

  return {
    days: rows,
    totalWorkedSeconds: rows.reduce((total, day) => total + day.workedSeconds, 0),
    totalBreakSeconds: rows.reduce((total, day) => total + day.breakSeconds, 0),
    totalLateSeconds: rows.reduce((total, day) => total + day.lateSeconds, 0),
  }
}

function stateOf(day: AttendanceDayRow | undefined): AttendanceState {
  if (!day) return 'absent'
  if (!day.isOpen) return 'out'
  return day.onBreak ? 'break' : 'in'
}

export async function loadBoard(date?: string): Promise<AttendanceBoard> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sees who is in today.')

  const settings = await settingsOf(caller.organizationId)
  const key = date || workDateKey(new Date(), settings.timeZone)

  const [members, days] = await Promise.all([
    db.member.findMany({
      where: { organizationId: caller.organizationId },
      select: {
        userId: true,
        user: { select: { name: true, preferredName: true, jobTitle: true } },
      },
    }),
    db.attendanceDay.findMany({
      where: { organizationId: caller.organizationId, workDate: dateOf(key) },
      select: daySelect,
    }),
  ])

  const byUser = new Map((await rowsFor(days, caller)).map((row) => [row.userId, row]))

  const rows = members
    .map((member) => {
      const day = byUser.get(member.userId)
      return {
        userId: member.userId,
        userName: member.user.preferredName ?? member.user.name,
        jobTitle: member.user.jobTitle ?? undefined,
        day,
        state: stateOf(day),
      }
    })
    .sort((a, b) => a.userName.localeCompare(b.userName))

  return {
    rows,
    date: key,
    presentCount: rows.filter((row) => row.state !== 'absent').length,
    lateCount: rows.filter((row) => (row.day?.lateSeconds ?? 0) > 0).length,
    absentCount: rows.filter((row) => row.state === 'absent').length,
  }
}

/** Pins a typed time of day to the work date, in the zone the organization counts days in. */
function instantOf(workDate: string, time: string, timeZone: string): Date {
  const at = zonedInstant(workDate, time, timeZone)
  if (!at) throw new ConnectError('Use a time like 09:00.', Code.InvalidArgument)
  return at
}

async function dayToEdit(caller: Caller, dayId: string) {
  const day = await db.attendanceDay.findFirst({
    where: { id: dayId, organizationId: caller.organizationId },
    select: { id: true },
  })
  if (!day) throw new ConnectError('That day is no longer there.', Code.NotFound)
  return day.id
}

/**
 * Only an admin writes a day, including their own: a clock nobody can edit is the whole point of
 * one, and a member who needs a correction asks for it.
 */
export async function saveAttendanceDay(values: AttendanceDayValues): Promise<AttendanceDayRow> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin records or corrects a day.')

  const settings = await settingsOf(caller.organizationId)
  const parsed = attendanceDaySchema.parse(values)

  const clockInAt = instantOf(parsed.workDate, parsed.clockInTime, settings.timeZone)
  const typedOut = parsed.clockOutTime
    ? instantOf(parsed.workDate, parsed.clockOutTime, settings.timeZone)
    : null
  // An end before its start ran past midnight, so it is that wall clock on the next date —
  // pinned again rather than shifted by 24 hours, which a clock change would make wrong.
  const clockOutAt =
    typedOut && typedOut.getTime() <= clockInAt.getTime()
      ? instantOf(shiftDateKey(parsed.workDate, 1), parsed.clockOutTime, settings.timeZone)
      : typedOut

  const names = await peopleNames([parsed.userId, caller.userId])
  const shift = await shiftFor(caller.organizationId, parsed.userId, settings)

  const breakSeconds = parsed.breakMinutes * 60
  const data = {
    clockInAt,
    clockOutAt,
    breakSeconds,
    workedSeconds: clockOutAt ? workedSecondsFor(clockInAt, clockOutAt, breakSeconds) : 0,
    lateSeconds: lateSecondsFor({
      clockInAt,
      shiftStartMinutes: shift.shiftStartMinutes,
      graceMinutes: shift.graceMinutes,
      timeZone: settings.timeZone,
    }),
    status: clockOutAt ? 'recorded' : 'open',
    source: 'manual',
    note: parsed.note || null,
    editedById: caller.userId,
  }

  const day = parsed.dayId
    ? await db.attendanceDay.update({
        where: { id: await dayToEdit(caller, parsed.dayId) },
        data,
        select: daySelect,
      })
    : await db.attendanceDay.upsert({
        where: { userId_workDate: { userId: parsed.userId, workDate: dateOf(parsed.workDate) } },
        create: {
          organizationId: caller.organizationId,
          userId: parsed.userId,
          workDate: dateOf(parsed.workDate),
          ...data,
        },
        update: data,
        select: daySelect,
      })

  await recordActivity({
    organizationId: caller.organizationId,
    subjectType: 'attendance',
    subjectId: day.id,
    action: 'attendance.day.edited',
    actorId: caller.userId,
    actorName: caller.name,
    detail: parsed.workDate,
  })

  return toDayRow(day, names, caller)
}

export async function deleteAttendanceDay(dayId: string): Promise<void> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin removes a day.')

  const day = await db.attendanceDay.findFirst({
    where: { id: dayId, organizationId: caller.organizationId },
    select: { id: true, workDate: true, clockInSelfieKey: true, clockOutSelfieKey: true },
  })
  if (!day) throw new ConnectError('That day is no longer there.', Code.NotFound)

  await db.attendanceDay.delete({ where: { id: day.id } })
  // The photos outlive nothing: the row they belonged to is gone, so the objects follow it.
  await forgetSelfies([day.clockInSelfieKey, day.clockOutSelfieKey])

  await recordActivity({
    organizationId: caller.organizationId,
    subjectType: 'attendance',
    subjectId: day.id,
    action: 'attendance.day.deleted',
    actorId: caller.userId,
    actorName: caller.name,
    detail: dateKeyOf(day.workDate),
  })
}

const shiftSelect = { ...shiftFields, _count: { select: { assignments: true } } } as const

interface ShiftRecord extends ShiftFields {
  _count: { assignments: number }
}

function toShiftRow(shift: ShiftRecord, defaultShiftId: string): AttendanceShiftRow {
  const { _count, ...fields } = shift
  return toShiftFields(fields, _count.assignments, shift.id === defaultShiftId)
}

export interface ShiftBook {
  shifts: AttendanceShiftRow[]
  settings: AttendanceSettingsRow
}

/** The shift library, written in the time clock and handed out under the organization. */
export async function loadShifts(): Promise<ShiftBook> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets shifts.')

  const [settings, shifts] = await Promise.all([
    settingsOf(caller.organizationId),
    db.attendanceShift.findMany({
      where: { organizationId: caller.organizationId },
      select: shiftSelect,
      orderBy: [{ shiftStartMinutes: 'asc' }, { name: 'asc' }],
    }),
  ])

  return { shifts: shifts.map((shift) => toShiftRow(shift, settings.defaultShiftId)), settings }
}

export async function saveShift(values: ShiftValues): Promise<AttendanceShiftRow> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets shifts.')

  const { shiftId, ...shift } = shiftSchema.parse(values)

  const clash = await db.attendanceShift.findFirst({
    where: {
      organizationId: caller.organizationId,
      name: shift.name,
      ...(shiftId ? { NOT: { id: shiftId } } : {}),
    },
    select: { id: true },
  })
  if (clash) {
    throw new ConnectError('A shift with that name already exists.', Code.AlreadyExists)
  }

  const settings = await settingsOf(caller.organizationId)

  if (!shiftId) {
    const created = await db.attendanceShift.create({
      data: { organizationId: caller.organizationId, ...shift },
      select: shiftSelect,
    })
    return toShiftRow(created, settings.defaultShiftId)
  }

  const existing = await db.attendanceShift.findFirst({
    where: { id: shiftId, organizationId: caller.organizationId },
    select: { id: true },
  })
  if (!existing) throw new ConnectError('That shift is no longer there.', Code.NotFound)

  const updated = await db.attendanceShift.update({
    where: { id: existing.id },
    data: shift,
    select: shiftSelect,
  })

  return toShiftRow(updated, settings.defaultShiftId)
}

/** Deleting a shift would silently put its people back on the company hours, so it asks first. */
export async function deleteShift(shiftId: string): Promise<void> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets shifts.')

  const shift = await db.attendanceShift.findFirst({
    where: { id: shiftId, organizationId: caller.organizationId },
    select: { id: true, _count: { select: { assignments: true } } },
  })
  if (!shift) throw new ConnectError('That shift is no longer there.', Code.NotFound)
  if (shift._count.assignments > 0) {
    throw new ConnectError(
      'People still work that shift — move them to another one first.',
      Code.FailedPrecondition,
    )
  }

  await db.attendanceShift.delete({ where: { id: shift.id } })
}

export interface ScheduleBook {
  schedules: AttendanceScheduleRow[]
  settings: AttendanceSettingsRow
  shifts: AttendanceShiftRow[]
}

export async function loadSchedules(): Promise<ScheduleBook> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets shifts.')

  const settings = await settingsOf(caller.organizationId)
  const [members, assignments, shifts, fallback] = await Promise.all([
    db.member.findMany({
      where: { organizationId: caller.organizationId },
      select: {
        userId: true,
        user: { select: { name: true, preferredName: true, jobTitle: true } },
      },
    }),
    db.attendanceSchedule.findMany({
      where: { organizationId: caller.organizationId },
      select: { userId: true, shift: { select: shiftFields } },
    }),
    db.attendanceShift.findMany({
      where: { organizationId: caller.organizationId },
      select: shiftSelect,
      orderBy: [{ shiftStartMinutes: 'asc' }, { name: 'asc' }],
    }),
    defaultShiftOf(caller.organizationId, settings),
  ])

  const byUser = new Map(assignments.map((row) => [row.userId, row.shift]))

  const schedules = members
    .map((member) => {
      const own = byUser.get(member.userId)
      const shift = own ? toShiftFields(own, 0, false) : fallback
      const name = member.user.preferredName ?? member.user.name
      return {
        ...scheduleFrom(member.userId, name, shift, Boolean(own)),
        jobTitle: member.user.jobTitle ?? undefined,
      }
    })
    .sort((a, b) => a.userName.localeCompare(b.userName))

  return {
    schedules,
    settings,
    shifts: shifts.map((shift) => toShiftRow(shift, settings.defaultShiftId)),
  }
}

/** Assignment happens where people are managed; an empty shift puts them on the company hours. */
export async function assignShift(values: AssignShiftValues): Promise<AttendanceScheduleRow> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets shifts.')

  const { userId, shiftId } = assignShiftSchema.parse(values)
  const member = await db.member.findFirst({
    where: { organizationId: caller.organizationId, userId },
    select: { user: { select: { name: true, preferredName: true, jobTitle: true } } },
  })
  if (!member) throw new ConnectError('That person is not in this organization.', Code.NotFound)

  const settings = await settingsOf(caller.organizationId)
  const userName = member.user.preferredName ?? member.user.name

  if (!shiftId) {
    await db.attendanceSchedule.deleteMany({
      where: { organizationId: caller.organizationId, userId },
    })
    const fallback = await defaultShiftOf(caller.organizationId, settings)
    return {
      ...scheduleFrom(userId, userName, fallback, false),
      jobTitle: member.user.jobTitle ?? undefined,
    }
  }

  const shift = await db.attendanceShift.findFirst({
    where: { id: shiftId, organizationId: caller.organizationId },
    select: shiftFields,
  })
  if (!shift) throw new ConnectError('That shift is no longer there.', Code.NotFound)

  await db.attendanceSchedule.upsert({
    where: { organizationId_userId: { organizationId: caller.organizationId, userId } },
    create: { organizationId: caller.organizationId, userId, shiftId: shift.id },
    update: { shiftId: shift.id },
    select: { id: true },
  })

  return {
    ...scheduleFrom(userId, userName, toShiftFields(shift, 0, false), true),
    jobTitle: member.user.jobTitle ?? undefined,
  }
}

const holidaySelect = { id: true, date: true, name: true } as const

function toHolidayRow(holiday: { id: string; date: Date; name: string }): AttendanceHolidayRow {
  return { id: holiday.id, date: dateKeyOf(holiday.date), name: holiday.name }
}

/** Everyone reads the calendar, since it says which days nobody is expected in. */
export async function loadHolidays(year: number): Promise<HolidayBook> {
  const caller = await requireMember()

  const holidays = await db.attendanceHoliday.findMany({
    where: {
      organizationId: caller.organizationId,
      date: { gte: dateOf(`${year}-01-01`), lte: dateOf(`${year}-12-31`) },
    },
    select: holidaySelect,
    orderBy: { date: 'asc' },
  })

  return { holidays: holidays.map(toHolidayRow), canManage: caller.canManage }
}

export async function saveHoliday(values: HolidayValues): Promise<AttendanceHolidayRow> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets the holiday calendar.')

  const { holidayId, date, name } = holidaySchema.parse(values)

  const clash = await db.attendanceHoliday.findFirst({
    where: {
      organizationId: caller.organizationId,
      date: dateOf(date),
      ...(holidayId ? { NOT: { id: holidayId } } : {}),
    },
    select: { name: true },
  })
  if (clash) {
    throw new ConnectError(`${date} is already ${clash.name}.`, Code.AlreadyExists)
  }

  if (!holidayId) {
    const created = await db.attendanceHoliday.create({
      data: { organizationId: caller.organizationId, date: dateOf(date), name },
      select: holidaySelect,
    })
    return toHolidayRow(created)
  }

  const existing = await db.attendanceHoliday.findFirst({
    where: { id: holidayId, organizationId: caller.organizationId },
    select: { id: true },
  })
  if (!existing) throw new ConnectError('That holiday is no longer there.', Code.NotFound)

  const updated = await db.attendanceHoliday.update({
    where: { id: existing.id },
    data: { date: dateOf(date), name },
    select: holidaySelect,
  })
  return toHolidayRow(updated)
}

export async function deleteHoliday(holidayId: string): Promise<void> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets the holiday calendar.')

  const { count } = await db.attendanceHoliday.deleteMany({
    where: { id: holidayId, organizationId: caller.organizationId },
  })
  if (count === 0) throw new ConnectError('That holiday is no longer there.', Code.NotFound)
}
