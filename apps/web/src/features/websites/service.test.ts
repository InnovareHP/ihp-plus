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
const storage = vi.hoisted(() => ({
  isObjectStorageConfigured: vi.fn(() => true),
  listObjects: vi.fn<() => Promise<{ key: string; lastModified: Date | undefined }[]>>(
    async () => [],
  ),
  deleteObjects: vi.fn<(keys: readonly string[]) => Promise<void>>(async () => undefined),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./probe', () => probe)
vi.mock('./access', () => access)
vi.mock('@/features/teams/leads', () => leads)
vi.mock('next/server', () => server)
vi.mock('@/lib/s3', () => storage)

const {
  queueLeadRound,
  queueSnapshots,
  runRoundFor,
  snapshotsEnabled,
  snapshotsOf,
  sweepOldSnapshots,
} = await import('./service')

const LEAD = { organizationId: 'org-1', userId: 'user-1', userName: 'Ada Lovelace' }
const today = new Date().toISOString().slice(0, 10)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runRoundFor', () => {
  it('records what each site answered as today’s check, keeping the lead’s note', async () => {
    prisma.website.findMany.mockResolvedValue([{ id: 'site-1', url: 'https://a.example' }])
    probe.probeWebsite.mockResolvedValue({ httpStatus: 503, responseMs: 80, error: '' })

    expect(await runRoundFor(LEAD, 'clock_in')).toEqual({
      today,
      checked: 1,
      websiteIds: ['site-1'],
    })

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

describe('snapshotsEnabled', () => {
  it('is on only with the secret, storage and a browser all in place', () => {
    vi.stubEnv('CRON_SECRET', 'shh')
    vi.stubEnv('SNAPSHOT_CHROME_PATH', '/usr/bin/chromium')
    expect(snapshotsEnabled()).toBe(true)

    storage.isObjectStorageConfigured.mockReturnValueOnce(false)
    expect(snapshotsEnabled()).toBe(false)

    vi.stubEnv('CRON_SECRET', '')
    expect(snapshotsEnabled()).toBe(false)
    vi.unstubAllEnvs()
  })
})

describe('queueSnapshots', () => {
  const JOB = { organizationId: 'org-1', dateKey: today, round: 'clock_in' as const }

  it('hands the sites to the capture route five at a time, with the secret', async () => {
    vi.stubEnv('CRON_SECRET', 'shh')
    vi.stubEnv('SNAPSHOT_CHROME_PATH', '/usr/bin/chromium')
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)

    await queueSnapshots({ ...JOB, websiteIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/app\/api\/websites\/snapshots\/capture$/)
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer shh')
    expect(JSON.parse(String(init.body)).websiteIds).toEqual(['a', 'b', 'c', 'd', 'e'])
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('does nothing without a secret or storage, so a check never fails on pictures', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('CRON_SECRET', '')
    await queueSnapshots({ ...JOB, websiteIds: ['a'] })

    vi.stubEnv('CRON_SECRET', 'shh')
    storage.isObjectStorageConfigured.mockReturnValueOnce(false)
    await queueSnapshots({ ...JOB, websiteIds: ['a'] })

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
})

describe('snapshotsOf', () => {
  const at = new Date('2026-11-03T09:00:00.000Z')
  const prefix = `website-snapshots/org-1/${today}/`

  it('offers a round once both sizes of its picture are stored', async () => {
    storage.listObjects.mockResolvedValueOnce([
      { key: `${prefix}site-1/clock_in-full.webp`, lastModified: at },
      { key: `${prefix}site-1/clock_in-thumb.webp`, lastModified: at },
      // A thumb alone means the full-size upload never landed.
      { key: `${prefix}site-1/clock_out-thumb.webp`, lastModified: at },
    ])

    const times = await snapshotsOf('org-1', today)

    expect(times.get('site-1')).toEqual({ clock_in: at.toISOString() })
  })

  it('costs only the pictures when storage is down', async () => {
    storage.listObjects.mockRejectedValueOnce(new Error('connection refused'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect((await snapshotsOf('org-1', today)).size).toBe(0)
  })
})

describe('sweepOldSnapshots', () => {
  const file = (org: string, day: string) =>
    `website-snapshots/${org}/${day}/site-1/clock_in-thumb.webp`

  it('deletes every picture from before today and keeps today’s', async () => {
    storage.listObjects.mockResolvedValueOnce([
      { key: file('org-1', '2026-11-02'), lastModified: undefined },
      { key: file('org-1', today), lastModified: undefined },
      { key: file('org-2', '2026-10-30'), lastModified: undefined },
      // Something else under the prefix is not ours to judge.
      { key: 'website-snapshots/org-1/notes.txt', lastModified: undefined },
    ])

    expect(await sweepOldSnapshots()).toBe(2)
    expect(storage.listObjects).toHaveBeenCalledWith('website-snapshots/')
    expect(storage.deleteObjects).toHaveBeenCalledWith([
      file('org-1', '2026-11-02'),
      file('org-2', '2026-10-30'),
    ])
  })

  it('looks only at one organization when named', async () => {
    await sweepOldSnapshots('org-1')

    expect(storage.listObjects).toHaveBeenCalledWith('website-snapshots/org-1/')
  })

  it('does nothing without storage', async () => {
    storage.isObjectStorageConfigured.mockReturnValueOnce(false)

    expect(await sweepOldSnapshots()).toBe(0)
    expect(storage.listObjects).not.toHaveBeenCalled()
  })
})
