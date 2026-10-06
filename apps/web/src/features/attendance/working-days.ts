import { db } from '@ihp/db'
import { DEFAULT_SHIFT } from './schema'
import { settingsOf } from './service'
import { workingDatesOf, type WorkPattern } from './utils/working-days'

const PATTERN_SELECT = { workdays: true, holidayCountry: true } as const

/**
 * Loads the shifts and holidays for a group of people once, so counting working days across a
 * whole team costs three queries rather than three per person.
 */
export async function workingDaysCalendar(
  organizationId: string,
  userIds: readonly string[],
  window: { from: string; to: string },
) {
  const settings = await settingsOf(organizationId)
  const [schedules, defaultShift, holidayRows] = await Promise.all([
    db.attendanceSchedule.findMany({
      where: { organizationId, userId: { in: [...userIds] } },
      select: { userId: true, shift: { select: PATTERN_SELECT } },
    }),
    settings.defaultShiftId
      ? db.attendanceShift.findFirst({
          where: { id: settings.defaultShiftId, organizationId },
          select: PATTERN_SELECT,
        })
      : null,
    db.attendanceHoliday.findMany({
      where: {
        organizationId,
        date: {
          gte: new Date(`${window.from}T00:00:00.000Z`),
          lte: new Date(`${window.to}T00:00:00.000Z`),
        },
      },
      select: { date: true, name: true, country: true },
    }),
  ])

  // A deleted default leaves the built-in hours standing, as the time clock does.
  const fallback: WorkPattern = defaultShift ?? DEFAULT_SHIFT
  const patterns = new Map(schedules.map((row) => [row.userId, row.shift]))
  const holidays = holidayRows.map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    name: row.name,
    country: row.country,
  }))

  return (userId: string, from: string, to: string) =>
    workingDatesOf(from, to, patterns.get(userId) ?? fallback, holidays)
}
