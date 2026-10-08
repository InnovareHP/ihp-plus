import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  website: { findMany: vi.fn(async (): Promise<unknown[]> => [{ organizationId: 'org-1' }]) },
  websiteCheck: { findMany: vi.fn(async (): Promise<unknown[]> => []) },
  member: {
    findMany: vi.fn(async () => [
      { user: { email: 'owner@ihp.example', banned: false } },
      { user: { email: 'gone@ihp.example', banned: true } },
    ]),
  },
}))
const service = vi.hoisted(() => ({
  todayOf: vi.fn(async () => '2026-10-10'),
  runRoundFor: vi.fn(async () => ({ today: '2026-10-10', checked: 3 })),
}))
const email = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ delivered: true })),
  portalUrl: (route: string) => `https://portal.test/app${route}`,
  websiteProblemsTemplate: vi.fn(() => ({ subject: 's', html: 'h', text: 't' })),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./service', () => service)
vi.mock('@/lib/email', () => email)

const { isWeekend, runWeekendChecks } = await import('./weekend')

const DOWN = {
  status: 'down',
  httpStatus: 503,
  responseMs: 90,
  error: '',
  note: '',
  website: { name: 'Riverside site', url: 'https://riverside.example' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('isWeekend', () => {
  it('knows Saturday and Sunday from the weekdays', () => {
    expect(isWeekend('2026-10-10')).toBe(true)
    expect(isWeekend('2026-10-11')).toBe(true)
    expect(isWeekend('2026-10-12')).toBe(false)
    expect(isWeekend('2026-10-09')).toBe(false)
  })
})

describe('runWeekendChecks', () => {
  it('checks the unchecked sites as the automatic checker and emails admins what is wrong', async () => {
    prisma.websiteCheck.findMany.mockResolvedValueOnce([DOWN])

    const summary = await runWeekendChecks('clock_in')

    expect(service.runRoundFor).toHaveBeenCalledWith(
      { organizationId: 'org-1', userId: 'automatic', userName: 'Automatic check' },
      'clock_in',
      { onlyUnchecked: true },
    )
    expect(email.websiteProblemsTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        roundLabel: 'Time in',
        problems: ['Riverside site (https://riverside.example): Down, HTTP 503 in 90 ms'],
        url: 'https://portal.test/app/websites',
      }),
    )
    // A banned admin is not written to.
    expect(email.sendEmail).toHaveBeenCalledTimes(1)
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@ihp.example' }),
    )
    expect(summary).toEqual({ organizations: 1, checked: 3, problems: 1, emailed: 1 })
  })

  it('sends nothing when every site is running', async () => {
    const summary = await runWeekendChecks('clock_out')

    expect(email.sendEmail).not.toHaveBeenCalled()
    expect(summary.problems).toBe(0)
  })

  it('leaves weekdays to the IT lead', async () => {
    service.todayOf.mockResolvedValueOnce('2026-10-12')

    const summary = await runWeekendChecks('clock_in')

    expect(service.runRoundFor).not.toHaveBeenCalled()
    expect(summary.organizations).toBe(0)
  })
})
