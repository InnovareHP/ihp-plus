import {
  formatTimeOfDay,
  isWorkday,
  minutesOfDay,
  minutesToClock,
  shiftDateKey,
  workDateKey,
  zonedInstant,
} from '@ihp/clock'

export type ReminderKind = 'clock_in' | 'clock_out'

/** A clock-out reminder waits this long past the shift's end, so finishing late is not nagged. */
export const CLOCK_OUT_GRACE_MINUTES = 30

export interface ShiftRules {
  name: string
  shiftStartMinutes: number
  shiftEndMinutes: number
  graceMinutes: number
  workdays: string
  autoClockOutHours: number
  sendReminders: boolean
}

export interface Person {
  userId: string
  email: string
  firstName: string
  /** The first date they could have been expected in. */
  since: string
  shift: ShiftRules
}

export interface OpenDay {
  userId: string
  workDate: string
  clockInAt: Date
}

/** One organization as the worker sees it at one instant. */
export interface OrgSnapshot {
  organizationId: string
  timeZone: string
  people: readonly Person[]
  /** True when today, in the organization's zone, is a company holiday. */
  holidayToday: boolean
  onLeaveToday: ReadonlySet<string>
  /** Everyone with any day recorded for today, running or closed. */
  clockedToday: ReadonlySet<string>
  /** Days still running, whatever date they started on. */
  openDays: readonly OpenDay[]
  /** Keyed by sentKey, for every reminder already sent. */
  sent: ReadonlySet<string>
}

export interface DueReminder {
  kind: ReminderKind
  organizationId: string
  userId: string
  email: string
  firstName: string
  workDate: string
  shift: ShiftRules
  /** The shift's start or end as the person reads it, "09:00". */
  at: string
  /** Clock-out only: when the clock will close the day on its own, as the person reads it. */
  closesAt: string | undefined
}

export function sentKey(userId: string, workDate: string, kind: ReminderKind) {
  return `${userId}|${workDate}|${kind}`
}

// A shift that ends at or before it starts finishes on the next calendar date.
function shiftEnd(workDate: string, shift: ShiftRules, timeZone: string): Date | undefined {
  const endDate =
    shift.shiftEndMinutes <= shift.shiftStartMinutes ? shiftDateKey(workDate, 1) : workDate
  return zonedInstant(endDate, minutesToClock(shift.shiftEndMinutes), timeZone)
}

function clockInDue(org: OrgSnapshot, person: Person, today: string, minutes: number) {
  const { shift } = person
  if (!shift.sendReminders || org.holidayToday) return false
  if (today < person.since || !isWorkday(today, shift.workdays)) return false
  if (org.onLeaveToday.has(person.userId) || org.clockedToday.has(person.userId)) return false
  if (org.sent.has(sentKey(person.userId, today, 'clock_in'))) return false

  const overnight = shift.shiftEndMinutes <= shift.shiftStartMinutes
  const pastGrace = minutes >= shift.shiftStartMinutes + shift.graceMinutes
  // Once a day shift is over, a clock-in reminder would only arrive after the fact.
  return pastGrace && (overnight || minutes < shift.shiftEndMinutes)
}

/**
 * Who needs an email right now: anyone scheduled today who is past their start and grace with no
 * clock-in, and anyone still clocked in well after their shift ended. Each reminder goes once.
 */
export function dueReminders(org: OrgSnapshot, now: Date): DueReminder[] {
  const today = workDateKey(now, org.timeZone)
  const minutes = minutesOfDay(now, org.timeZone)
  const byUser = new Map(org.people.map((person) => [person.userId, person]))
  const due: DueReminder[] = []

  for (const person of org.people) {
    if (!clockInDue(org, person, today, minutes)) continue
    due.push({
      kind: 'clock_in',
      organizationId: org.organizationId,
      userId: person.userId,
      email: person.email,
      firstName: person.firstName,
      workDate: today,
      shift: person.shift,
      at: minutesToClock(person.shift.shiftStartMinutes),
      closesAt: undefined,
    })
  }

  for (const day of org.openDays) {
    const person = byUser.get(day.userId)
    if (!person?.shift.sendReminders) continue
    if (org.sent.has(sentKey(day.userId, day.workDate, 'clock_out'))) continue

    const end = shiftEnd(day.workDate, person.shift, org.timeZone)
    if (!end || now.getTime() < end.getTime() + CLOCK_OUT_GRACE_MINUTES * 60_000) continue

    const hours = person.shift.autoClockOutHours
    const closes = hours > 0 ? new Date(day.clockInAt.getTime() + hours * 3_600_000) : undefined
    // Past the limit the day is closed on its next read; a reminder then would be stale.
    if (closes && now.getTime() >= closes.getTime()) continue

    due.push({
      kind: 'clock_out',
      organizationId: org.organizationId,
      userId: person.userId,
      email: person.email,
      firstName: person.firstName,
      workDate: day.workDate,
      shift: person.shift,
      at: minutesToClock(person.shift.shiftEndMinutes),
      closesAt: closes ? formatTimeOfDay(closes, org.timeZone) : undefined,
    })
  }

  return due
}
