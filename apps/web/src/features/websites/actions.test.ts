import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  website: {
    findMany: vi.fn(async (): Promise<unknown[]> => []),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  websiteCheck: { findMany: vi.fn(async (): Promise<unknown[]> => []), upsert: vi.fn() },
  websiteSettings: { upsert: vi.fn() },
  client: { findMany: vi.fn(async (): Promise<unknown[]> => []), findFirst: vi.fn() },
  team: { findFirst: vi.fn() },
}))

const LEAD = {
  userId: 'user-1',
  userName: 'Ada Lovelace',
  organizationId: 'org-1',
  canView: true,
  canCheck: true,
  canManage: true,
  canConfigure: false,
  itTeamId: 'team-it',
}

const access = vi.hoisted(() => ({ websitesAccess: vi.fn() }))
const probe = vi.hoisted(() => ({ probeWebsite: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./access', () => access)
vi.mock('./probe', () => probe)
vi.mock('./service', () => ({ timeZoneOf: vi.fn(async () => 'UTC') }))

const { createWebsite, exportMonth, loadChecklist, recordCheck, runRound, saveItTeam } =
  await import('./actions')

const SITE = {
  id: 'site-1',
  name: 'Riverside site',
  url: 'https://riverside.example',
  clientId: null,
  notes: '',
}

const today = new Date().toISOString().slice(0, 10)

beforeEach(() => {
  vi.clearAllMocks()
  access.websitesAccess.mockResolvedValue(LEAD)
})

describe('who may do what', () => {
  it('refuses anyone outside IT, without saying more', async () => {
    access.websitesAccess.mockResolvedValue({ ...LEAD, canView: false, canCheck: false })

    expect(await loadChecklist()).toEqual({
      ok: false,
      message: 'This page is only for the IT department.',
    })
    expect(prisma.website.findMany).not.toHaveBeenCalled()
  })

  it('lets an IT member read but not run the checks', async () => {
    access.websitesAccess.mockResolvedValue({ ...LEAD, canCheck: false, canManage: false })

    expect((await loadChecklist()).ok).toBe(true)
    expect(await runRound({ round: 'clock_in' })).toMatchObject({ ok: false })
    expect(probe.probeWebsite).not.toHaveBeenCalled()
  })

  it('leaves picking the IT department to admins', async () => {
    expect(await saveItTeam({ itTeamId: 'team-2' })).toMatchObject({ ok: false })
    expect(prisma.websiteSettings.upsert).not.toHaveBeenCalled()
  })
})

describe('runRound', () => {
  it('opens every site and records what came back as today’s check', async () => {
    prisma.website.findMany.mockResolvedValue([SITE])
    probe.probeWebsite.mockResolvedValue({ httpStatus: 503, responseMs: 80, error: '' })

    const result = await runRound({ round: 'clock_in' })

    expect(result.ok).toBe(true)
    expect(probe.probeWebsite).toHaveBeenCalledWith(SITE.url)
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
    // A rerun keeps whatever the lead wrote.
    expect(call.update).not.toHaveProperty('note')
  })
})

describe('recordCheck', () => {
  it('asks for a note when the site is not running', async () => {
    const result = await recordCheck({
      websiteId: 'site-1',
      round: 'clock_out',
      status: 'issue',
      note: '',
    })

    expect(result).toEqual({ ok: false, message: 'Say what is wrong so the next person knows.' })
    expect(prisma.websiteCheck.upsert).not.toHaveBeenCalled()
  })

  it('stores the lead’s verdict for today', async () => {
    prisma.website.findFirst.mockResolvedValue(SITE)

    const result = await recordCheck({
      websiteId: 'site-1',
      round: 'clock_out',
      status: 'issue',
      note: 'Contact form returns a blank page',
    })

    expect(result.ok).toBe(true)
    expect(prisma.websiteCheck.upsert.mock.calls[0]?.[0].update).toMatchObject({
      status: 'issue',
      note: 'Contact form returns a blank page',
    })
  })
})

describe('createWebsite', () => {
  it('turns away an address that is not http or https', async () => {
    const result = await createWebsite({
      name: 'FTP',
      url: 'ftp://files.example',
      clientId: '',
      notes: '',
    })

    expect(result).toMatchObject({ ok: false })
    expect(prisma.website.create).not.toHaveBeenCalled()
  })
})

describe('exportMonth', () => {
  it('lists each site on each day so far, with the day’s checks beside it', async () => {
    const month = today.slice(0, 7)
    prisma.website.findMany.mockResolvedValue([
      { ...SITE, createdAt: new Date(`${month}-01T00:00:00.000Z`), archivedAt: null },
    ])
    prisma.websiteCheck.findMany.mockResolvedValue([
      {
        websiteId: 'site-1',
        workDate: new Date(`${month}-01T00:00:00.000Z`),
        round: 'clock_in',
        status: 'up',
        httpStatus: 200,
        responseMs: 120,
        error: '',
        note: '',
        checkedByName: 'Ada Lovelace',
        checkedAt: new Date(`${month}-01T01:00:00.000Z`),
      },
    ])

    const result = await exportMonth(month)

    if (!result.ok) throw new Error(result.message)
    expect(result.data.rows).toHaveLength(Number(today.slice(8, 10)))
    expect(result.data.rows[0]).toMatchObject({ date: `${month}-01`, website: 'Riverside site' })
    expect(result.data.rows[0]?.checks.clock_in?.status).toBe('up')
    expect(result.data.rows[0]?.checks.clock_out).toBeUndefined()
  })

  it('refuses a month that has not started', async () => {
    expect(await exportMonth('2999-01')).toEqual({
      ok: false,
      message: 'That month has not started yet.',
    })
  })
})
