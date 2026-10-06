import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  hiringSettings: { findUnique: vi.fn() },
  jobPosting: { findMany: vi.fn() },
  jobApplication: { findMany: vi.fn() },
  jobOffer: { groupBy: vi.fn() },
}))
const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
// membershipOf and canManageOrganization are pure, so the real ones decide who runs hiring.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const { loadHiringReport } = await import('./report-service')
const { DEFAULT_REPORT_QUERY, DEFAULT_STAGES } = await import('./schema')

const NOW = new Date('2026-10-06T00:00:00Z')

function signedIn(role: 'admin' | 'member') {
  guard.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Ada Lovelace' } })
  guard.readProfile.mockResolvedValue({
    preferredName: null,
    role: 'user',
    members: [{ role, organizationId: 'org-1' }],
    teammembers: [],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  signedIn('admin')
  prisma.hiringSettings.findUnique.mockResolvedValue(null)
  prisma.jobPosting.findMany.mockResolvedValue([
    { id: 'post-1', title: 'Registered nurse', stages: DEFAULT_STAGES },
    { id: 'post-2', title: 'Care coordinator', stages: DEFAULT_STAGES },
  ])
  prisma.jobApplication.findMany.mockResolvedValue([
    {
      postingId: 'post-1',
      stageId: 'interview',
      status: 'active',
      createdAt: new Date('2026-09-01T00:00:00Z'),
      decidedAt: null,
      events: [{ detail: { toStageId: 'screening' } }, { detail: { toStageId: 'interview' } }],
    },
    {
      postingId: 'post-1',
      stageId: 'offer',
      status: 'hired',
      createdAt: new Date('2026-09-01T00:00:00Z'),
      decidedAt: new Date('2026-09-15T00:00:00Z'),
      events: [{ detail: 'not an object' }],
    },
  ])
  prisma.jobOffer.groupBy.mockResolvedValue([
    { status: 'accepted', _count: { _all: 3 } },
    { status: 'declined', _count: { _all: 1 } },
  ])
})

describe('loadHiringReport', () => {
  it('reports the cohort that applied in the period', async () => {
    const report = await loadHiringReport(DEFAULT_REPORT_QUERY, NOW)

    expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          postingId: undefined,
          createdAt: { gte: new Date('2026-07-08T00:00:00Z') },
        },
      }),
    )
    expect(report.totals).toMatchObject({ applications: 2, active: 1, hired: 1 })
    expect(report.totals.medianDaysToHire).toBe(14)
    expect(report.offersAccepted).toBe(3)
    expect(report.offersDeclined).toBe(1)
    expect(report.funnel.map((step) => step.reached)).toEqual([2, 2, 2, 1, 1])
    // A posting nobody applied to in the period stays out of the table.
    expect(report.postings.map((row) => row.title)).toEqual(['Registered nurse'])
    expect(report.postingOptions).toHaveLength(2)
  })

  it('narrows to one posting, and drops a posting id the organization does not own', async () => {
    await loadHiringReport({ period: 'all', postingId: 'post-2' }, NOW)
    expect(prisma.jobApplication.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', postingId: 'post-2', createdAt: undefined },
      }),
    )
    expect(prisma.jobOffer.groupBy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ application: { postingId: 'post-2' } }),
      }),
    )

    const report = await loadHiringReport({ period: 'all', postingId: 'someone-elses' }, NOW)
    expect(report.postingId).toBeUndefined()
    expect(prisma.jobApplication.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ postingId: undefined }) }),
    )
  })

  it('refuses someone outside HR', async () => {
    signedIn('member')
    const error = await loadHiringReport(DEFAULT_REPORT_QUERY, NOW).catch((thrown) => thrown)
    expect(ConnectError.from(error).code).toBe(Code.PermissionDenied)
    expect(prisma.jobApplication.findMany).not.toHaveBeenCalled()
  })
})
