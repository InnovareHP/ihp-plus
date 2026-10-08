import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  attendanceSettings: { findUnique: vi.fn(async () => ({ timeZone: 'UTC' })) },
  website: {
    findMany: vi.fn<(args: { where: Record<string, unknown> }) => Promise<unknown[]>>(
      async () => [],
    ),
  },
  websiteCheck: { upsert: vi.fn() },
}))
const probe = vi.hoisted(() => ({ probeWebsite: vi.fn() }))
const leads = vi.hoisted(() => ({ isTeamLead: vi.fn(async () => false) }))
const access = vi.hoisted(() => ({
  itTeamIdOf: vi.fn(async (): Promise<string | undefined> => 'team-it'),
}))
const server = vi.hoisted(() => ({ after: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./probe', () => probe)
vi.mock('./access', () => access)
vi.mock('@/features/teams/leads', () => leads)
vi.mock('next/server', () => server)

const { queueLeadRound, runRoundFor } = await import('./service')

const LEAD = { organizationId: 'org-1', userId: 'user-1', userName: 'Ada Lovelace' }
const today = new Date().toISOString().slice(0, 10)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runRoundFor', () => {
  it('records what each site answered as today’s check, keeping the lead’s note', async () => {
    prisma.website.findMany.mockResolvedValue([{ id: 'site-1', url: 'https://a.example' }])
    probe.probeWebsite.mockResolvedValue({ httpStatus: 503, responseMs: 80, error: '' })

    expect(await runRoundFor(LEAD, 'clock_in')).toEqual({ today, checked: 1 })

    const call = prisma.websiteCheck.upsert.mock.calls[0]?.[0]
    expect(call.where.websiteId_workDate_round).toEqual({
      websiteId: 'site-1',
      workDate: new Date(`${today}T00:00:00.000Z`),
      round: 'clock_in',
    })
    expect(call.create).toMatchObject({
      status: 'down',
      httpStatus: 503,
      checkedByName: 'Ada Lovelace',
    })
    expect(call.update).not.toHaveProperty('note')
  })

  it('leaves alone a round someone already checked when asked to', async () => {
    await runRoundFor(LEAD, 'clock_out', { onlyUnchecked: true })

    expect(prisma.website.findMany.mock.calls[0]?.[0].where.checks).toEqual({
      none: { workDate: new Date(`${today}T00:00:00.000Z`), round: 'clock_out' },
    })
  })
})

describe('queueLeadRound', () => {
  it('starts the round after the punch when the IT lead punches', async () => {
    leads.isTeamLead.mockResolvedValueOnce(true)

    expect(await queueLeadRound(LEAD, 'clock_in')).toBe(true)
    expect(server.after).toHaveBeenCalledTimes(1)
  })

  it('does nothing for anyone else, or when no IT department is set', async () => {
    expect(await queueLeadRound(LEAD, 'clock_in')).toBe(false)

    access.itTeamIdOf.mockResolvedValueOnce(undefined)
    expect(await queueLeadRound(LEAD, 'clock_in')).toBe(false)
    expect(server.after).not.toHaveBeenCalled()
  })

  it('never fails the punch when the lookup does', async () => {
    access.itTeamIdOf.mockRejectedValueOnce(new Error('database down'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(await queueLeadRound(LEAD, 'clock_out')).toBe(false)
  })
})
