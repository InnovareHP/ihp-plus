import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  attendanceHoliday: { findMany: vi.fn(), createMany: vi.fn() },
  attendanceHolidayImport: { findUnique: vi.fn(), upsert: vi.fn() },
  attendanceShift: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))

const { fillHolidays, fillHolidaysOnce, fillUpcomingHolidays } = await import('./holiday-calendar')

const day = (key: string) => new Date(`${key}T00:00:00.000Z`)

describe('the holiday calendar fill', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    prisma.$transaction.mockResolvedValue([])
    prisma.attendanceHoliday.findMany.mockResolvedValue([])
    prisma.attendanceHolidayImport.findUnique.mockResolvedValue(null)
  })

  it('writes only the dates that country’s calendar does not have yet, and records the year', async () => {
    // An admin already renamed Rizal Day; the fill must not add a second one or overwrite it.
    prisma.attendanceHoliday.findMany.mockResolvedValueOnce([{ date: day('2026-12-30') }])

    await fillHolidays('org-1', 'PH', 2026)

    const written = prisma.attendanceHoliday.createMany.mock.calls[0]?.[0]
    const dates = written.data.map((row: { date: Date }) => row.date.toISOString().slice(0, 10))
    expect(dates).toContain('2026-06-12')
    expect(dates).not.toContain('2026-12-30')
    expect(written.data[0]).toMatchObject({
      organizationId: 'org-1',
      country: 'PH',
      source: 'imported',
    })
    expect(written.skipDuplicates).toBe(true)
    expect(prisma.attendanceHolidayImport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_country_year: { organizationId: 'org-1', country: 'PH', year: 2026 },
        },
      }),
    )
  })

  it('never fills a year twice on its own, so a deleted day stays deleted', async () => {
    prisma.attendanceHolidayImport.findUnique.mockResolvedValue({ id: 'import-1' })

    expect(await fillHolidaysOnce('org-1', 'PH', 2026)).toBe(0)
    expect(prisma.attendanceHoliday.createMany).not.toHaveBeenCalled()
  })

  it('fills this year and next for every country a shift follows', async () => {
    prisma.attendanceShift.findMany.mockResolvedValue([
      { organizationId: 'org-1', holidayCountry: 'PH' },
      { organizationId: 'org-2', holidayCountry: 'US' },
    ])

    await fillUpcomingHolidays(new Date('2026-12-01T03:00:00Z'))

    const filled = prisma.attendanceHolidayImport.findUnique.mock.calls.map(
      ([args]) => args.where.organizationId_country_year,
    )
    expect(filled).toEqual([
      { organizationId: 'org-1', country: 'PH', year: 2026 },
      { organizationId: 'org-1', country: 'PH', year: 2027 },
      { organizationId: 'org-2', country: 'US', year: 2026 },
      { organizationId: 'org-2', country: 'US', year: 2027 },
    ])
  })
})
