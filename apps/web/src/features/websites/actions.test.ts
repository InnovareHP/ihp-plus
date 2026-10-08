import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  website: {
    findMany: vi.fn<(args: { where: Record<string, unknown> }) => Promise<unknown[]>>(
      async () => [],
    ),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  websiteCheck: {
    findMany: vi.fn<(args: { where: Record<string, unknown> }) => Promise<unknown[]>>(
      async () => [],
    ),
    upsert: vi.fn(),
  },
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
const service = vi.hoisted(() => ({
  timeZoneOf: vi.fn(async () => 'UTC'),
  runRoundFor: vi.fn(async () => ({ today: new Date().toISOString().slice(0, 10), checked: 1 })),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./access', () => access)
vi.mock('./service', () => service)

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
    expect(service.runRoundFor).not.toHaveBeenCalled()
  })

  it('leaves picking the IT department to admins', async () => {
    expect(await saveItTeam({ itTeamId: 'team-2' })).toMatchObject({ ok: false })
    expect(prisma.websiteSettings.upsert).not.toHaveBeenCalled()
  })
})

describe('runRound', () => {
  it('runs the round as the lead and answers with today’s list', async () => {
    prisma.website.findMany.mockResolvedValue([SITE])

    const result = await runRound({ round: 'clock_in' })

    expect(result.ok).toBe(true)
    expect(service.runRoundFor).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', userName: 'Ada Lovelace' }),
      'clock_in',
      { websiteId: undefined },
    )
  })

  it('says so when the one site asked for is gone', async () => {
    service.runRoundFor.mockResolvedValueOnce({ today, checked: 0 })

    expect(await runRound({ round: 'clock_out', websiteId: 'gone' })).toEqual({
      ok: false,
      message: 'That website is no longer on the list.',
    })
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

    const result = await exportMonth({ month, websiteId: '' })

    if (!result.ok) throw new Error(result.message)
    expect(result.data.rows).toHaveLength(Number(today.slice(8, 10)))
    expect(result.data.rows[0]).toMatchObject({ date: `${month}-01`, website: 'Riverside site' })
    expect(result.data.rows[0]?.checks.clock_in?.status).toBe('up')
    expect(result.data.rows[0]?.checks.clock_out).toBeUndefined()
  })

  it('refuses a month that has not started', async () => {
    expect(await exportMonth({ month: '2999-01', websiteId: '' })).toEqual({
      ok: false,
      message: 'That month has not started yet.',
    })
  })

  it('narrows the report to one website and names it', async () => {
    const month = today.slice(0, 7)
    prisma.website.findMany.mockResolvedValue([])
    prisma.website.findFirst.mockResolvedValue({ name: 'Riverside site' })

    const result = await exportMonth({ month, websiteId: 'site-1' })

    if (!result.ok) throw new Error(result.message)
    expect(result.data.websiteName).toBe('Riverside site')
    expect(prisma.website.findMany.mock.calls[0]?.[0].where).toMatchObject({ id: 'site-1' })
    expect(prisma.websiteCheck.findMany.mock.calls[0]?.[0].where).toMatchObject({
      websiteId: 'site-1',
    })
  })

  it('refuses a website from another organization', async () => {
    prisma.website.findFirst.mockResolvedValue(null)

    expect(await exportMonth({ month: today.slice(0, 7), websiteId: 'elsewhere' })).toEqual({
      ok: false,
      message: 'That website no longer exists.',
    })
  })
})
