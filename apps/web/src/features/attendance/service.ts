import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { recordActivity } from '@/lib/activity'
import { canManageOrganization, getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { deleteObject, objectUrl } from '@/lib/s3'
import {
  attendanceDaySchema,
  attendanceSettingsSchema,
  clockActionSchema,
  DEFAULT_ATTENDANCE_SETTINGS,
  scheduleSchema,
  type AttendanceBoard,
  type AttendanceDayRow,
  type AttendanceDayValues,
  type AttendanceLog,
  type AttendanceScheduleRow,
  type AttendanceSettingsRow,
  type AttendanceSettingsView,
  type AttendanceSource,
  type AttendanceState,
  type AttendanceStatus,
  type ClockActionValues,
  type ScheduleValues,
  type TimeClockView,
} from './schema'
import {
  lateSecondsFor,
  shiftDateKey,
  workDateKey,
  workedSecondsFor,
  zonedInstant,
} from './utils/clock'

const SETTINGS_SELECT = {
  requireSelfie: true,
  allowManualEntry: true,
  requireNote: true,
  captureLocation: true,
  autoClockOutHours: true,
  shiftStartMinutes: true,
  shiftEndMinutes: true,
  graceMinutes: true,
  workdays: true,
  timeZone: true,
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
  approvedById: true,
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
  approvedById: string | null
  breaks: BreakRecord[]
}

export async function settingsOf(organizationId: string): Promise<AttendanceSettingsRow> {
  const stored = await db.attendanceSettings.findUnique({
    where: { organizationId },
    select: SETTINGS_SELECT,
  })

  // Defaults live here, so an organization that never opens the screen still has rules.
  return stored ?? DEFAULT_ATTENDANCE_SETTINGS
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
  return value === 'open' || value === 'approved' ? value : 'recorded'
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

/** A selfie is the person's own business and the admin's; nobody else is handed the link. */
async function toDayRow(
  day: DayRecord,
  names: Map<string, string>,
  viewer: Caller,
): Promise<AttendanceDayRow> {
  const maySeePhotos = viewer.canManage || viewer.userId === day.userId
  const [clockInSelfieUrl, clockOutSelfieUrl] = maySeePhotos
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
    clockInLocation: day.clockInLocation ?? undefined,
    clockOutLocation: day.clockOutLocation ?? undefined,
    isOpen: day.clockOutAt === null,
    onBreak: day.breaks.some((one) => one.endedAt === null),
    breaks: day.breaks.map((one) => ({
      id: one.id,
      startedAt: one.startedAt.toISOString(),
      endedAt: one.endedAt?.toISOString(),
      seconds: one.seconds,
      isRunning: one.endedAt === null,
    })),
    approvedByName: day.approvedById ? (names.get(day.approvedById) ?? 'An admin') : undefined,
  }
}

async function rowsFor(days: DayRecord[], viewer: Caller): Promise<AttendanceDayRow[]> {
  const names = await peopleNames(days.flatMap((day) => [day.userId, day.approvedById ?? '']))
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

async function openDayOf(caller: Caller, settings: AttendanceSettingsRow) {
  const open = await db.attendanceDay.findFirst({
    where: { userId: caller.userId, organizationId: caller.organizationId, clockOutAt: null },
    select: daySelect,
    orderBy: { clockInAt: 'desc' },
  })
  if (!open) return null

  const settled = await closeForgottenDay(open, settings.autoClockOutHours)
  return settled.clockOutAt === null ? settled : null
}

async function scheduleOf(
  organizationId: string,
  userId: string,
  settings: AttendanceSettingsRow,
  userName: string,
): Promise<AttendanceScheduleRow> {
  const own = await db.attendanceSchedule.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: {
      shiftStartMinutes: true,
      shiftEndMinutes: true,
      graceMinutes: true,
      workdays: true,
    },
  })

  return {
    userId,
    userName,
    shiftStartMinutes: own?.shiftStartMinutes ?? settings.shiftStartMinutes,
    shiftEndMinutes: own?.shiftEndMinutes ?? settings.shiftEndMinutes,
    graceMinutes: own?.graceMinutes ?? settings.graceMinutes,
    workdays: own?.workdays ?? settings.workdays,
    isDefault: !own,
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

  return db.attendanceSettings.upsert({
    where: { organizationId: caller.organizationId },
    create: { organizationId: caller.organizationId, ...parsed },
    update: parsed,
    select: SETTINGS_SELECT,
  })
}

export async function loadTimeClock(): Promise<TimeClockView> {
  const caller = await requireMember()
  const settings = await settingsOf(caller.organizationId)
  const [open, schedule] = await Promise.all([
    openDayOf(caller, settings),
    scheduleOf(caller.organizationId, caller.userId, settings, caller.name),
  ])

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

  return {
    today: today ? await toDayRow(today, names, caller) : undefined,
    settings,
    schedule,
    canManage: caller.canManage,
  }
}

function checkedClockValues(values: ClockActionValues, settings: AttendanceSettingsRow) {
  const parsed = clockActionSchema.parse(values)
  if (settings.requireSelfie && !parsed.selfieKey) {
    throw new ConnectError('Your company asks for a selfie at the clock.', Code.InvalidArgument)
  }
  return parsed
}

export async function clockIn(values: ClockActionValues): Promise<AttendanceDayRow> {
  const caller = await requireMember()
  const settings = await settingsOf(caller.organizationId)
  const parsed = checkedClockValues(values, settings)

  const open = await openDayOf(caller, settings)
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

  const schedule = await scheduleOf(caller.organizationId, caller.userId, settings, caller.name)

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
        shiftStartMinutes: schedule.shiftStartMinutes,
        graceMinutes: schedule.graceMinutes,
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
  const parsed = checkedClockValues(values, settings)
  if (settings.requireNote && !parsed.note) {
    throw new ConnectError('Your company asks what you worked on today.', Code.InvalidArgument)
  }

  const open = await openDayOf(caller, settings)
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

  const open = await openDayOf(caller, settings)
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

  const open = await openDayOf(caller, settings)
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

/** A member may only touch their own row; anyone else's is an admin's business. */
async function dayToEdit(caller: Caller, dayId: string) {
  const day = await db.attendanceDay.findFirst({
    where: { id: dayId, organizationId: caller.organizationId },
    select: { id: true, userId: true },
  })
  if (!day) throw new ConnectError('That day is no longer there.', Code.NotFound)
  if (day.userId !== caller.userId) requireAdmin(caller, 'Only an admin edits somebody else’s day.')
  return day.id
}

export async function saveAttendanceDay(values: AttendanceDayValues): Promise<AttendanceDayRow> {
  const caller = await requireMember()
  const settings = await settingsOf(caller.organizationId)
  const parsed = attendanceDaySchema.parse(values)

  if (parsed.userId !== caller.userId) {
    requireAdmin(caller, 'Only an admin edits somebody else’s day.')
  }
  if (!caller.canManage && !settings.allowManualEntry) {
    throw new ConnectError(
      'Your company records attendance by the clock only.',
      Code.PermissionDenied,
    )
  }

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
  const schedule = await scheduleOf(
    caller.organizationId,
    parsed.userId,
    settings,
    names.get(parsed.userId) ?? 'Someone',
  )

  const breakSeconds = parsed.breakMinutes * 60
  const data = {
    clockInAt,
    clockOutAt,
    breakSeconds,
    workedSeconds: clockOutAt ? workedSecondsFor(clockInAt, clockOutAt, breakSeconds) : 0,
    lateSeconds: lateSecondsFor({
      clockInAt,
      shiftStartMinutes: schedule.shiftStartMinutes,
      graceMinutes: schedule.graceMinutes,
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

export async function approveAttendanceDay(
  dayId: string,
  approved: boolean,
): Promise<AttendanceDayRow> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin signs off attendance.')

  const existing = await db.attendanceDay.findFirst({
    where: { id: dayId, organizationId: caller.organizationId },
    select: { id: true, clockOutAt: true },
  })
  if (!existing) throw new ConnectError('That day is no longer there.', Code.NotFound)
  if (approved && existing.clockOutAt === null) {
    throw new ConnectError(
      'That day is still running — it cannot be signed off yet.',
      Code.FailedPrecondition,
    )
  }

  const day = await db.attendanceDay.update({
    where: { id: existing.id },
    data: {
      status: approved ? 'approved' : 'recorded',
      approvedById: approved ? caller.userId : null,
      approvedAt: approved ? new Date() : null,
    },
    select: daySelect,
  })

  return toDayRow(day, await peopleNames([day.userId, caller.userId]), caller)
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

export interface ScheduleBook {
  schedules: AttendanceScheduleRow[]
  settings: AttendanceSettingsRow
}

export async function loadSchedules(): Promise<ScheduleBook> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets shifts.')

  const settings = await settingsOf(caller.organizationId)
  const [members, own] = await Promise.all([
    db.member.findMany({
      where: { organizationId: caller.organizationId },
      select: { userId: true, user: { select: { name: true, preferredName: true } } },
    }),
    db.attendanceSchedule.findMany({
      where: { organizationId: caller.organizationId },
      select: {
        userId: true,
        shiftStartMinutes: true,
        shiftEndMinutes: true,
        graceMinutes: true,
        workdays: true,
      },
    }),
  ])

  const byUser = new Map(own.map((row) => [row.userId, row]))

  const schedules = members
    .map((member) => {
      const shift = byUser.get(member.userId)
      return {
        userId: member.userId,
        userName: member.user.preferredName ?? member.user.name,
        shiftStartMinutes: shift?.shiftStartMinutes ?? settings.shiftStartMinutes,
        shiftEndMinutes: shift?.shiftEndMinutes ?? settings.shiftEndMinutes,
        graceMinutes: shift?.graceMinutes ?? settings.graceMinutes,
        workdays: shift?.workdays ?? settings.workdays,
        isDefault: !shift,
      }
    })
    .sort((a, b) => a.userName.localeCompare(b.userName))

  return { schedules, settings }
}

export async function saveSchedule(values: ScheduleValues): Promise<AttendanceScheduleRow> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets shifts.')

  const { userId, ...shift } = scheduleSchema.parse(values)
  const member = await db.member.findFirst({
    where: { organizationId: caller.organizationId, userId },
    select: { user: { select: { name: true, preferredName: true } } },
  })
  if (!member) throw new ConnectError('That person is not in this organization.', Code.NotFound)

  const saved = await db.attendanceSchedule.upsert({
    where: { organizationId_userId: { organizationId: caller.organizationId, userId } },
    create: { organizationId: caller.organizationId, userId, ...shift },
    update: shift,
    select: {
      shiftStartMinutes: true,
      shiftEndMinutes: true,
      graceMinutes: true,
      workdays: true,
    },
  })

  return {
    userId,
    userName: member.user.preferredName ?? member.user.name,
    ...saved,
    isDefault: false,
  }
}

export async function deleteSchedule(userId: string): Promise<void> {
  const caller = await requireMember()
  requireAdmin(caller, 'Only an admin sets shifts.')

  await db.attendanceSchedule.deleteMany({
    where: { organizationId: caller.organizationId, userId },
  })
}
