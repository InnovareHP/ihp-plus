import { db } from '@ihp/db'
import type { AttendanceHolidayRow } from './schema'
import { publicHolidays } from './utils/public-holidays'

export const holidaySelect = {
  id: true,
  date: true,
  name: true,
  country: true,
  source: true,
} as const

export function toHolidayRow(holiday: {
  id: string
  date: Date
  name: string
  country: string
  source: string
}): AttendanceHolidayRow {
  return {
    id: holiday.id,
    date: holiday.date.toISOString().slice(0, 10),
    name: holiday.name,
    country: holiday.country,
    imported: holiday.source === 'imported',
  }
}

function dateOf(key: string) {
  return new Date(`${key}T00:00:00.000Z`)
}

/**
 * Writes one country's public holidays for one year, leaving any date that calendar already has
 * alone so an admin's rename survives, and records that the year was filled.
 */
export async function fillHolidays(
  organizationId: string,
  country: string,
  year: number,
): Promise<AttendanceHolidayRow[]> {
  const days = publicHolidays(country, year)
  const existing = await db.attendanceHoliday.findMany({
    where: { organizationId, country, date: { in: days.map((day) => dateOf(day.date)) } },
    select: { date: true },
  })
  const taken = new Set(existing.map((one) => one.date.toISOString().slice(0, 10)))
  const missing = days.filter((day) => !taken.has(day.date))

  await db.$transaction([
    db.attendanceHoliday.createMany({
      data: missing.map((day) => ({
        organizationId,
        country,
        date: dateOf(day.date),
        name: day.name,
        source: 'imported',
      })),
      skipDuplicates: true,
    }),
    db.attendanceHolidayImport.upsert({
      where: { organizationId_country_year: { organizationId, country, year } },
      create: { organizationId, country, year },
      update: { importedAt: new Date() },
    }),
  ])

  if (missing.length === 0) return []
  const added = await db.attendanceHoliday.findMany({
    where: { organizationId, country, date: { in: missing.map((day) => dateOf(day.date)) } },
    select: holidaySelect,
    orderBy: { date: 'asc' },
  })
  return added.map(toHolidayRow)
}

/** The automatic path: a year already filled once is never filled again, so deletions stick. */
export async function fillHolidaysOnce(organizationId: string, country: string, year: number) {
  const done = await db.attendanceHolidayImport.findUnique({
    where: { organizationId_country_year: { organizationId, country, year } },
    select: { id: true },
  })
  if (done) return 0
  return (await fillHolidays(organizationId, country, year)).length
}

/**
 * Makes sure every country a shift follows has this year and next on the calendar, which is what
 * the yearly cron and a shift gaining a country both need.
 */
export async function fillUpcomingHolidays(now = new Date(), organizationId?: string) {
  const shifts = await db.attendanceShift.findMany({
    where: { holidayCountry: { not: '' }, ...(organizationId ? { organizationId } : {}) },
    select: { organizationId: true, holidayCountry: true },
    distinct: ['organizationId', 'holidayCountry'],
  })

  const year = now.getUTCFullYear()
  let added = 0
  for (const shift of shifts) {
    for (const target of [year, year + 1]) {
      added += await fillHolidaysOnce(shift.organizationId, shift.holidayCountry, target)
    }
  }
  return added
}
