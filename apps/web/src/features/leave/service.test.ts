import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  attendanceSettings: { findUnique: vi.fn() },
  attendanceSchedule: { findMany: vi.fn() },
  attendanceShift: { findFirst: vi.fn() },
  attendanceHoliday: { findMany: vi.fn() },
  attendanceLeave: { groupBy: vi.fn() },
  requestApprover: { findMany: vi.fn() },
  requestForm: { findMany: vi.fn(), findFirst: vi.fn() },
  requestSubmission: { findMany: vi.fn(), findFirst: vi.fn() },
  leaveAllowance: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  member: { findMany: vi.fn() },
}))
const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
// membershipOf and canManageOrganization are pure, so the real ones decide who is an admin.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const { loadMyBalances, loadTeamBalances, previewLeave, setAllowance } = await import('./service')

const VACATION = { id: 'form-1', name: 'Vacation leave', leaveAllowance: 15 }

function signedIn(options: { isAdmin?: boolean; userId?: string; approverOf?: string[] } = {}) {
  const userId = options.userId ?? 'user-1'
  guard.getSession.mockResolvedValue({ user: { id: userId, name: 'Ada Lovelace' } })
  guard.readProfile.mockResolvedValue({
    preferredName: null,
    role: 'user',
    members: [{ role: options.isAdmin ? 'admin' : 'member', organizationId: 'org-1' }],
    teammembers: [{ team: { id: 'team-1', name: 'Revenue Cycle' } }],
  })
  prisma.requestApprover.findMany.mockResolvedValue(
    (options.approverOf ?? []).map((teamId) => ({ teamId })),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  signedIn()
  prisma.attendanceSettings.findUnique.mockResolvedValue(null)
  // Monday to Friday, with Tuesday 13 October a company holiday.
  prisma.attendanceSchedule.findMany.mockResolvedValue([])
  prisma.attendanceHoliday.findMany.mockResolvedValue([
    { date: new Date('2026-10-13T00:00:00.000Z'), name: 'Founders day', country: '' },
  ])
  prisma.requestForm.findMany.mockResolvedValue([VACATION])
  prisma.requestForm.findFirst.mockResolvedValue(VACATION)
  prisma.leaveAllowance.findMany.mockResolvedValue([])
  prisma.requestSubmission.findMany.mockResolvedValue([
    { id: 'sub-approved', formId: 'form-1', requesterId: 'user-1', status: 'approved', values: {} },
    {
      id: 'sub-pending',
      formId: 'form-1',
      requesterId: 'user-1',
      status: 'pending',
      // Friday to Wednesday: Fri, Mon and Wed are working days; the weekend and holiday are not.
      values: { 'time-off-first-day': '2026-10-09', 'time-off-last-day': '2026-10-14' },
    },
  ])
  prisma.attendanceLeave.groupBy.mockResolvedValue([
    { submissionId: 'sub-approved', _count: { _all: 4 } },
  ])
  prisma.member.findMany.mockResolvedValue([
    { userId: 'user-2', user: { name: 'Grace Hopper', preferredName: null, banned: false } },
    { userId: 'user-1', user: { name: 'Ada Lovelace', preferredName: null, banned: false } },
    { userId: 'user-3', user: { name: 'Gone', preferredName: null, banned: true } },
  ])
})

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

describe('loadMyBalances', () => {
  it('counts booked days as used and pending requests in working days', async () => {
    const mine = await loadMyBalances(2026)

    expect(prisma.requestForm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teams: { some: { teamId: 'team-1' } } }),
      }),
    )
    // Cancelled approvals no longer count, so only live ones are read.
    expect(prisma.requestSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ status: 'approved', cancelledAt: null }, { status: 'pending' }],
        }),
      }),
    )
    expect(mine).toEqual({
      year: 2026,
      balances: [
        {
          formId: 'form-1',
          formName: 'Vacation leave',
          allowance: 15,
          used: 4,
          pending: 3,
          remaining: 11,
          overridden: false,
        },
      ],
    })
  })

  it('applies a person’s own allowance', async () => {
    prisma.leaveAllowance.findMany.mockResolvedValue([
      { formId: 'form-1', userId: 'user-1', days: 20 },
    ])
    const mine = await loadMyBalances(2026)
    expect(mine.balances[0]).toMatchObject({ allowance: 20, remaining: 16, overridden: true })
  })
})

describe('previewLeave', () => {
  it('counts the working days the caller is about to ask for', async () => {
    const preview = await previewLeave({
      formId: 'form-1',
      firstDay: '2026-10-09',
      lastDay: '2026-10-14',
    })
    expect(preview.workingDays).toBe(3)
    expect(preview.balance).toMatchObject({ remaining: 11, pending: 3 })
  })

  it('leaves a request’s own days out of pending when its approver previews it', async () => {
    signedIn({ userId: 'approver', approverOf: ['team-1'] })
    prisma.requestSubmission.findFirst.mockResolvedValue({
      id: 'sub-pending',
      formId: 'form-1',
      requesterId: 'user-1',
      teamId: 'team-1',
      values: { 'time-off-first-day': '2026-10-09', 'time-off-last-day': '2026-10-14' },
    })

    const preview = await previewLeave({ submissionId: 'sub-pending' })
    expect(preview.workingDays).toBe(3)
    expect(preview.balance).toMatchObject({ used: 4, pending: 0, remaining: 11 })
  })

  it('hides a request from someone who may not read it', async () => {
    signedIn({ userId: 'stranger' })
    prisma.requestSubmission.findFirst.mockResolvedValue({
      id: 'sub-pending',
      formId: 'form-1',
      requesterId: 'user-1',
      teamId: 'team-1',
      values: {},
    })
    expect(await codeOf(() => previewLeave({ submissionId: 'sub-pending' }))).toBe(Code.NotFound)
  })

  it('returns no balance for a form that tracks none', async () => {
    prisma.requestForm.findFirst.mockResolvedValue({ ...VACATION, leaveAllowance: null })
    const preview = await previewLeave({
      formId: 'form-1',
      firstDay: '2026-10-12',
      lastDay: '2026-10-12',
    })
    expect(preview).toEqual({ workingDays: 1, balance: undefined })
  })

  it('refuses dates in the wrong order', async () => {
    expect(
      await codeOf(() =>
        previewLeave({ formId: 'form-1', firstDay: '2026-10-14', lastDay: '2026-10-09' }),
      ),
    ).toBe(Code.InvalidArgument)
  })
})

describe('loadTeamBalances', () => {
  it('lists every active member by name with a balance per tracked form', async () => {
    signedIn({ isAdmin: true })
    prisma.requestSubmission.findMany.mockResolvedValue([])
    prisma.attendanceLeave.groupBy.mockResolvedValue([])

    const team = await loadTeamBalances(2026)
    expect(team.forms).toEqual([{ formId: 'form-1', formName: 'Vacation leave', allowance: 15 }])
    expect(team.people.map((person) => person.name)).toEqual(['Ada Lovelace', 'Grace Hopper'])
    expect(team.people[0]?.balances[0]).toMatchObject({ used: 0, remaining: 15 })
  })

  it('is for admins only', async () => {
    expect(await codeOf(() => loadTeamBalances(2026))).toBe(Code.PermissionDenied)
  })
})

describe('setAllowance', () => {
  it('saves a person’s own allowance', async () => {
    signedIn({ isAdmin: true })
    await setAllowance({ formId: 'form-1', userId: 'user-2', days: 20 })
    expect(prisma.leaveAllowance.upsert).toHaveBeenCalledWith({
      where: { formId_userId: { formId: 'form-1', userId: 'user-2' } },
      create: { organizationId: 'org-1', formId: 'form-1', userId: 'user-2', days: 20 },
      update: { days: 20 },
    })
  })

  it('puts the person back on the form’s allowance when no days are given', async () => {
    signedIn({ isAdmin: true })
    await setAllowance({ formId: 'form-1', userId: 'user-2' })
    expect(prisma.leaveAllowance.deleteMany).toHaveBeenCalledWith({
      where: { formId: 'form-1', userId: 'user-2' },
    })
    expect(prisma.leaveAllowance.upsert).not.toHaveBeenCalled()
  })

  it('refuses a form that tracks no allowance, a non-member, and a non-admin', async () => {
    signedIn({ isAdmin: true })
    expect(await codeOf(() => setAllowance({ formId: 'other', userId: 'user-2', days: 5 }))).toBe(
      Code.NotFound,
    )
    prisma.member.findMany.mockResolvedValue([])
    expect(await codeOf(() => setAllowance({ formId: 'form-1', userId: 'nobody', days: 5 }))).toBe(
      Code.NotFound,
    )

    signedIn()
    expect(await codeOf(() => setAllowance({ formId: 'form-1', userId: 'user-2', days: 5 }))).toBe(
      Code.PermissionDenied,
    )
  })
})
