import { db } from '@ihp/db'
import { workDateKey } from '@ihp/clock'

// The attendance zone, so "today" here is the same day the lead clocked in on.
export async function timeZoneOf(organizationId: string) {
  const settings = await db.attendanceSettings.findUnique({
    where: { organizationId },
    select: { timeZone: true },
  })
  return settings?.timeZone ?? 'UTC'
}

export async function todayOf(organizationId: string) {
  return workDateKey(new Date(), await timeZoneOf(organizationId))
}
