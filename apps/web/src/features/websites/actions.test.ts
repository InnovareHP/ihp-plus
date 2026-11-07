import { beforeEach, describe, expect, it, vi } from 'vitest'
import { websiteDayKey } from './utils/work-day'

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
  websiteShiftCheck: {
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
  runRoundFor: vi.fn(async () => ({
    today: new Date().toISOString().slice(0, 10),
    checked: 1,
    websiteIds: ['site-1'],
  })),
  queueSnapshots: vi.fn(async () => undefined),
  snapshotsOf: vi.fn(async () => new Map()),
  snapshotsEnabled: vi.fn(() => true),
}))
const server = vi.hoisted(() => ({ after: vi.fn((task: () => unknown) => task()) }))
const expiry = vi.hoisted(() => ({
  expiryOf: vi.fn(async () => ({ domain: '2027-03-14T00:00:00.000Z', ssl: undefined })),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./access', () => access)
vi.mock('./service', () => service)
vi.mock('next/server', () => server)
vi.mock('./expiry', () => expiry)

const {
  createWebsite,
  exportDayReport,
  exportMonth,
  loadChecklist,
  loadExpiry,
  recordCheck,
  runRound,
  saveItTeam,
  saveShiftCheck,
} = await import('./actions')

const SITE = {
  id: 'site-1',
  name: 'Riverside site',
  url: 'https://riverside.example',
  clientId: null,
  notes: '',
}

// The website day starts at noon, so a morning run still belongs to yesterday's shift.
const today = websiteDayKey(new Date(), 'UTC')

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
    service.runRoundFor.mockResolvedValueOnce({ today, checked: 1, websiteIds: ['site-1'] })

    const result = await runRound({ round: 'clock_in' })

    expect(result.ok).toBe(true)
    expect(service.runRoundFor).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', userName: 'Ada Lovelace' }),
      'clock_in',
      { websiteId: undefined },
    )
    expect(service.queueSnapshots).toHaveBeenCalledWith({
      organizationId: 'org-1',
      dateKey: today,
      round: 'clock_in',
      websiteIds: ['site-1'],
    })
  })

  it('says so when the one site asked for is gone', async () => {
    service.runRoundFor.mockResolvedValueOnce({ today, checked: 0, websiteIds: [] })

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

describe('exportDayReport', () => {
  it('hands back a letterheaded PDF named after the shift, for anyone who can see the list', async () => {
    access.websitesAccess.mockResolvedValue({ ...LEAD, canCheck: false, canManage: false })
    prisma.website.findMany.mockResolvedValueOnce([SITE])
    prisma.websiteCheck.findMany.mockResolvedValueOnce([
      {
        websiteId: 'site-1',
        workDate: new Date(`${today}T00:00:00.000Z`),
        round: 'clock_in',
        status: 'down',
        httpStatus: 502,
        responseMs: 40,
        error: '',
        note: 'Homepage shows a 502',
        checkedByName: 'Ada Lovelace',
        checkedAt: new Date(),
      },
    ])

    const result = await exportDayReport({ date: today })

    if (!result.ok) throw new Error(result.message)
    expect(result.data.fileName).toBe(`Daily-Website-Check-${today}.pdf`)
    expect(new TextDecoder().decode(result.data.bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('refuses a shift that has not started', async () => {
    expect(await exportDayReport({ date: '2999-01-01' })).toEqual({
      ok: false,
      message: 'That shift has not started yet.',
    })
  })

  it('refuses anyone outside IT', async () => {
    access.websitesAccess.mockResolvedValue({ ...LEAD, canView: false, canCheck: false })

    expect(await exportDayReport({ date: today })).toEqual({
      ok: false,
      message: 'This page is only for the IT department.',
    })
  })
})

describe('saveShiftCheck', () => {
  it('saves only the field that was clicked, against today, as the lead', async () => {
    prisma.website.findFirst.mockResolvedValue(SITE)

    const result = await saveShiftCheck({ websiteId: 'site-1', pagesButtons: 'fail' })

    expect(result.ok).toBe(true)
    const call = prisma.websiteShiftCheck.upsert.mock.calls[0]?.[0] as {
      where: { websiteId_workDate: { websiteId: string; workDate: Date } }
      update: Record<string, unknown>
    }
    expect(call.where.websiteId_workDate.websiteId).toBe('site-1')
    expect(call.where.websiteId_workDate.workDate.toISOString().slice(0, 10)).toBe(today)
    expect(call.update).toEqual({
      pagesButtons: 'fail',
      checkedById: 'user-1',
      checkedByName: 'Ada Lovelace',
    })
  })

  it('dates a form email test so later reports can carry it', async () => {
    prisma.website.findFirst.mockResolvedValue(SITE)

    await saveShiftCheck({ websiteId: 'site-1', formEmail: 'pass' })

    const call = prisma.websiteShiftCheck.upsert.mock.calls[0]?.[0] as {
      update: { formEmail: string; formEmailAt: Date }
    }
    expect(call.update.formEmail).toBe('pass')
    expect(call.update.formEmailAt).toBeInstanceOf(Date)
  })

  it('leaves the hand checks to the IT lead', async () => {
    access.websitesAccess.mockResolvedValue({ ...LEAD, canCheck: false })

    expect(await saveShiftCheck({ websiteId: 'site-1', pagesButtons: 'pass' })).toEqual({
      ok: false,
      message: 'Only the IT lead runs the time-in and time-out checks.',
    })
    expect(prisma.websiteShiftCheck.upsert).not.toHaveBeenCalled()
  })

  it('refuses a site that is no longer on the list', async () => {
    prisma.website.findFirst.mockResolvedValue(null)

    expect(await saveShiftCheck({ websiteId: 'gone', findings: 'x' })).toEqual({
      ok: false,
      message: 'That website is no longer on the list.',
    })
  })
})

describe('loadExpiry', () => {
  it('reads the dates for a site in the caller’s organization', async () => {
    prisma.website.findFirst.mockResolvedValue({ url: SITE.url })

    expect(await loadExpiry({ websiteId: 'site-1' })).toEqual({
      ok: true,
      data: { domain: '2027-03-14T00:00:00.000Z', ssl: undefined },
    })
    expect(expiry.expiryOf).toHaveBeenCalledWith(SITE.url)
  })
})
