import { COMPANY_HOURS, shiftDateKey, workDateKey } from '@ihp/clock'
import { db } from '@ihp/db'
import {
  clockInReminderTemplate,
  clockOutReminderTemplate,
  portalUrl,
  sendEmail,
} from '@/lib/email'
import { routes } from '@/lib/routes'
import {
  dueReminders,
  sentKey,
  type DueReminder,
  type OrgSnapshot,
  type Person,
  type ShiftRules,
} from './utils/reminders'

const COMPANY_SHIFT: ShiftRules = { ...COMPANY_HOURS, name: 'Company hours' }

const shiftSelect = {
  id: true,
  name: true,
  shiftStartMinutes: true,
  shiftEndMinutes: true,
  graceMinutes: true,
  workdays: true,
  autoClockOutHours: true,
  sendReminders: true,
} as const

function dateKeyOf(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dateOf(key: string) {
  return new Date(`${key}T00:00:00.000Z`)
}

/** Every organization's clock as it stands now, read in one pass rather than per organization. */
export async function loadSnapshots(now: Date): Promise<OrgSnapshot[]> {
  // Zones run from UTC-12 to UTC+14, so every organization's today sits within a day of UTC's.
  const utcToday = dateKeyOf(now)
  const window = { gte: dateOf(shiftDateKey(utcToday, -1)), lte: dateOf(shiftDateKey(utcToday, 1)) }

  const [organizations, settings, members, schedules, holidays, leave, days] = await Promise.all([
    db.organization.findMany({ select: { id: true } }),
    db.attendanceSettings.findMany({
      select: { organizationId: true, timeZone: true, defaultShift: { select: shiftSelect } },
    }),
    db.member.findMany({
      select: {
        organizationId: true,
        userId: true,
        createdAt: true,
        user: {
          select: { email: true, name: true, preferredName: true, startDate: true, banned: true },
        },
      },
    }),
    db.attendanceSchedule.findMany({
      select: { userId: true, shift: { select: shiftSelect } },
    }),
    db.attendanceHoliday.findMany({
      where: { date: window },
      select: { organizationId: true, date: true },
    }),
    db.attendanceLeave.findMany({
      where: { date: window },
      select: { userId: true, date: true },
    }),
    db.attendanceDay.findMany({
      where: { OR: [{ clockOutAt: null }, { workDate: window }] },
      select: {
        organizationId: true,
        userId: true,
        workDate: true,
        clockInAt: true,
        clockOutAt: true,
      },
    }),
  ])

  // An open day can be older than the window, and its clock-out reminder is keyed by its own date.
  const oldest = days.reduce(
    (earliest, day) => (day.workDate < earliest ? day.workDate : earliest),
    window.gte,
  )
  const sent = await db.attendanceReminder.findMany({
    where: { workDate: { gte: oldest } },
    select: { userId: true, workDate: true, kind: true },
  })
  const sentKeys = new Set(
    sent.map((one) =>
      sentKey(
        one.userId,
        dateKeyOf(one.workDate),
        one.kind === 'clock_out' ? 'clock_out' : 'clock_in',
      ),
    ),
  )

  const ownShift = new Map(schedules.map((row) => [row.userId, row.shift]))
  const settingsOf = new Map(settings.map((row) => [row.organizationId, row]))

  return organizations.map(({ id }) => {
    const orgSettings = settingsOf.get(id)
    const timeZone = orgSettings?.timeZone ?? 'UTC'
    const today = workDateKey(now, timeZone)
    const fallback = orgSettings?.defaultShift ?? COMPANY_SHIFT

    const people: Person[] = members
      .filter((member) => member.organizationId === id && !member.user.banned)
      .map((member) => {
        const joined = workDateKey(member.createdAt, timeZone)
        const started = member.user.startDate ? dateKeyOf(member.user.startDate) : undefined
        const name = member.user.preferredName ?? member.user.name
        return {
          userId: member.userId,
          email: member.user.email,
          firstName: name.split(' ')[0] || name,
          since: started && started > joined ? started : joined,
          shift: ownShift.get(member.userId) ?? fallback,
        }
      })
    const userIds = new Set(people.map((person) => person.userId))
    const orgDays = days.filter((day) => day.organizationId === id)

    return {
      organizationId: id,
      timeZone,
      people,
      holidayToday: holidays.some(
        (one) => one.organizationId === id && dateKeyOf(one.date) === today,
      ),
      onLeaveToday: new Set(
        leave
          .filter((one) => userIds.has(one.userId) && dateKeyOf(one.date) === today)
          .map((one) => one.userId),
      ),
      clockedToday: new Set(
        orgDays.filter((day) => dateKeyOf(day.workDate) === today).map((day) => day.userId),
      ),
      openDays: orgDays
        .filter((day) => day.clockOutAt === null)
        .map((day) => ({
          userId: day.userId,
          workDate: dateKeyOf(day.workDate),
          clockInAt: day.clockInAt,
        })),
      sent: sentKeys,
    }
  })
}

function emailFor(reminder: DueReminder) {
  const url = portalUrl(routes.attendance)
  return reminder.kind === 'clock_in'
    ? clockInReminderTemplate({
        firstName: reminder.firstName,
        shiftName: reminder.shift.name,
        startsAt: reminder.at,
        url,
      })
    : clockOutReminderTemplate({
        firstName: reminder.firstName,
        shiftName: reminder.shift.name,
        endedAt: reminder.at,
        closesAt: reminder.closesAt,
        url,
      })
}

/**
 * Claims each reminder in the log before sending it, so an overlapping or retried cron run never
 * emails the same person twice; a failed send is logged by sendEmail, not retried into a duplicate.
 */
export async function sendDueReminders(now = new Date()): Promise<number> {
  const snapshots = await loadSnapshots(now)
  let sent = 0

  for (const reminder of snapshots.flatMap((org) => dueReminders(org, now))) {
    const claimed = await db.attendanceReminder.createMany({
      data: [
        {
          organizationId: reminder.organizationId,
          userId: reminder.userId,
          workDate: dateOf(reminder.workDate),
          kind: reminder.kind,
        },
      ],
      skipDuplicates: true,
    })
    if (claimed.count === 0) continue

    const result = await sendEmail({ to: reminder.email, ...emailFor(reminder) })
    if (result.delivered) sent += 1
  }

  return sent
}
