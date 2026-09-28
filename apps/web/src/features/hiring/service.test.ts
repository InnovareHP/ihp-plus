import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  hiringSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  jobPosting: {
    count: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  jobApplication: { count: vi.fn(), groupBy: vi.fn() },
  requestForm: { findFirst: vi.fn() },
  team: { findFirst: vi.fn(), findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({
  getSession: vi.fn(),
  readProfile: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
// membershipOf and canManageOrganization are pure, so the real ones decide who is an admin.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const {
  deletePosting,
  loadPostingsPage,
  loadSettings,
  savePosting,
  saveSettings,
  setPostingStatus,
} = await import('./service')
const { DEFAULT_REJECTION_MESSAGE, DEFAULT_STAGES } = await import('./schema')

function signedIn(options: { isAdmin?: boolean; teamId?: string } = {}) {
  guard.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Ada Lovelace' } })
  guard.readProfile.mockResolvedValue({
    preferredName: null,
    role: 'user',
    members: [{ role: options.isAdmin ? 'admin' : 'member', organizationId: 'org-1' }],
    teammembers: [{ team: { id: options.teamId ?? 'team-hr', name: 'People & Culture' } }],
  })
}

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

const POSTING = {
  id: 'post-1',
  organizationId: 'org-1',
  createdById: 'user-1',
  teamId: 'team-care',
  slug: 'registered-nurse-abc123',
  title: 'Registered nurse',
  summary: 'Care for patients',
  description: 'You will care for patients across our outpatient clinics every day.',
  location: 'Manila',
  workplace: 'onsite',
  employmentType: 'full_time',
  salaryMin: 30000,
  salaryMax: 40000,
  salaryCurrency: 'PHP',
  status: 'draft',
  resumeRequired: true,
  stages: DEFAULT_STAGES,
  applicationFormId: null,
  applicationForm: null,
  openedAt: null,
  closesAt: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-02T00:00:00.000Z'),
}

const DRAFT = {
  title: 'Registered nurse',
  summary: 'Care for patients',
  description: 'You will care for patients across our outpatient clinics every day.',
  location: 'Manila',
  workplace: 'onsite' as const,
  employmentType: 'full_time' as const,
  salaryMin: 30000,
  salaryMax: 40000,
  salaryCurrency: 'php',
  resumeRequired: true,
  stages: [...DEFAULT_STAGES],
  applicationFormId: '',
  teamId: '',
  closesAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  signedIn()
  prisma.hiringSettings.findUnique.mockResolvedValue({
    organizationId: 'org-1',
    hrTeamId: 'team-hr',
    defaultStages: DEFAULT_STAGES,
    rejectionMessage: '',
  })
  prisma.team.findMany.mockResolvedValue([{ id: 'team-care', name: 'Care Management' }])
  prisma.team.findFirst.mockResolvedValue({ id: 'team-hr', name: 'People & Culture' })
  prisma.jobApplication.groupBy.mockResolvedValue([])
  prisma.jobApplication.count.mockResolvedValue(0)
  prisma.jobPosting.findFirst.mockResolvedValue(POSTING)
})

describe('who may hire', () => {
  it('lets the HR department in without being an admin', async () => {
    const settings = await loadSettings()

    expect(settings.hrTeamName).toBe('People & Culture')
    expect(settings.canEditHrTeam).toBe(false)
    // An unset message falls back to the portal's own wording rather than sending nothing.
    expect(settings.rejectionMessage).toBe(DEFAULT_REJECTION_MESSAGE)
  })

  it('refuses a member of any other department', async () => {
    signedIn({ teamId: 'team-care' })

    expect(await codeOf(loadSettings)).toBe(Code.PermissionDenied)
  })

  it('leaves hiring to admins until a department is picked', async () => {
    prisma.hiringSettings.findUnique.mockResolvedValue(null)

    expect(await codeOf(loadSettings)).toBe(Code.PermissionDenied)

    signedIn({ isAdmin: true, teamId: 'team-care' })
    const settings = await loadSettings()
    expect(settings.defaultStages.map((stage) => stage.id)).toEqual(
      DEFAULT_STAGES.map((stage) => stage.id),
    )
  })
})

describe('settings', () => {
  const VALUES = {
    hrTeamId: 'team-hr',
    defaultStages: [...DEFAULT_STAGES],
    rejectionMessage: 'Thanks, but not this time.',
  }

  it('lets HR change the stages and the message but not who runs hiring', async () => {
    await saveSettings(VALUES)
    expect(prisma.hiringSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          hrTeamId: 'team-hr',
          rejectionMessage: VALUES.rejectionMessage,
        }),
      }),
    )

    expect(await codeOf(() => saveSettings({ ...VALUES, hrTeamId: 'team-care' }))).toBe(
      Code.PermissionDenied,
    )
  })

  it('lets an admin hand hiring to another department', async () => {
    signedIn({ isAdmin: true, teamId: 'team-care' })
    prisma.team.findFirst.mockResolvedValue({ id: 'team-care', name: 'Care Management' })

    await saveSettings({ ...VALUES, hrTeamId: 'team-care' })

    expect(prisma.hiringSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ hrTeamId: 'team-care' }) }),
    )
  })

  it('refuses stages that move the entry stage off the top', async () => {
    const [entry, ...rest] = DEFAULT_STAGES
    expect(await codeOf(() => saveSettings({ ...VALUES, defaultStages: [...rest, entry!] }))).toBe(
      Code.InvalidArgument,
    )
  })
})

describe('postings', () => {
  it('creates a draft with a readable slug and an upper-case currency', async () => {
    prisma.jobPosting.create.mockImplementation(async ({ data }) => ({
      ...POSTING,
      ...data,
      applicationForm: null,
    }))

    const saved = await savePosting(DRAFT)

    const data = prisma.jobPosting.create.mock.calls[0]?.[0].data
    expect(data.slug).toMatch(/^registered-nurse-[a-z0-9]{6}$/)
    expect(data.salaryCurrency).toBe('PHP')
    expect(data.organizationId).toBe('org-1')
    expect(saved.status).toBe('draft')
  })

  it('will not drop a stage that applicants are still sitting in', async () => {
    prisma.jobApplication.count.mockResolvedValue(2)

    const error = await savePosting({
      ...DRAFT,
      postingId: 'post-1',
      stages: DEFAULT_STAGES.filter((stage) => stage.id !== 'interview'),
    }).then(
      () => undefined,
      (thrown: unknown) => ConnectError.from(thrown),
    )

    expect(error?.code).toBe(Code.FailedPrecondition)
    expect(error?.rawMessage).toContain('2 applicants are still in a stage you removed')
    expect(prisma.jobPosting.update).not.toHaveBeenCalled()
  })

  it('refuses an application form that is not an application form', async () => {
    prisma.requestForm.findFirst.mockResolvedValue(null)

    expect(await codeOf(() => savePosting({ ...DRAFT, applicationFormId: 'form-1' }))).toBe(
      Code.NotFound,
    )
  })

  it('stamps when a posting first opened and keeps that date on a reopen', async () => {
    prisma.jobPosting.update.mockResolvedValue({ ...POSTING, status: 'open' })

    await setPostingStatus({ postingId: 'post-1', status: 'open' })
    expect(prisma.jobPosting.update.mock.calls[0]?.[0].data.openedAt).toBeInstanceOf(Date)

    prisma.jobPosting.findFirst.mockResolvedValue({
      ...POSTING,
      status: 'closed',
      openedAt: new Date('2026-09-05T00:00:00.000Z'),
    })
    await setPostingStatus({ postingId: 'post-1', status: 'open' })
    expect(prisma.jobPosting.update.mock.calls[1]?.[0].data.openedAt).toBeUndefined()
  })

  it('will not publish a posting with no description', async () => {
    prisma.jobPosting.findFirst.mockResolvedValue({ ...POSTING, description: '' })

    expect(await codeOf(() => setPostingStatus({ postingId: 'post-1', status: 'open' }))).toBe(
      Code.FailedPrecondition,
    )
  })

  it('will not turn a posting the public has seen back into a draft', async () => {
    prisma.jobPosting.findFirst.mockResolvedValue({
      ...POSTING,
      status: 'closed',
      openedAt: new Date('2026-09-05T00:00:00.000Z'),
    })

    expect(await codeOf(() => setPostingStatus({ postingId: 'post-1', status: 'draft' }))).toBe(
      Code.FailedPrecondition,
    )
  })

  it('deletes a draft nobody applied to, and only that', async () => {
    await deletePosting('post-1')
    expect(prisma.jobPosting.delete).toHaveBeenCalledWith({ where: { id: 'post-1' } })

    prisma.jobApplication.count.mockResolvedValue(1)
    expect(await codeOf(() => deletePosting('post-1'))).toBe(Code.FailedPrecondition)
  })

  it('counts applicants per stage, leaving finished ones out of the pipeline', async () => {
    prisma.jobPosting.count.mockResolvedValue(1)
    prisma.jobPosting.findMany.mockResolvedValue([POSTING])
    prisma.jobApplication.groupBy.mockResolvedValue([
      { postingId: 'post-1', status: 'active', stageId: 'applied', _count: { _all: 3 } },
      { postingId: 'post-1', status: 'active', stageId: 'interview', _count: { _all: 1 } },
      { postingId: 'post-1', status: 'rejected', stageId: 'screening', _count: { _all: 2 } },
    ])

    const page = await loadPostingsPage({
      search: '',
      status: 'current',
      teamIds: [],
      page: 1,
      pageSize: 25,
    })

    expect(page.rows[0]).toMatchObject({
      applicantCount: 6,
      activeCount: 4,
      stageCounts: { applied: 3, interview: 1 },
      teamName: 'Care Management',
    })
    // "Not archived" is the default view.
    expect(prisma.jobPosting.count.mock.calls[0]?.[0].where.status).toEqual({ not: 'archived' })
  })
})
