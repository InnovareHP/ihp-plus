import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  team: { findUnique: vi.fn() },
  member: { findFirst: vi.fn() },
  user: { update: vi.fn() },
}))
const guard = vi.hoisted(() => ({ requireSession: vi.fn() }))
const lookups = vi.hoisted(() => ({ isKnownOption: vi.fn() }))
const orgAdapter = vi.hoisted(() => ({ findOrCreateTeamMember: vi.fn() }))
const authApi = vi.hoisted(() => ({ addMember: vi.fn(), addTeamMember: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', () => guard)
vi.mock('@/features/lookups/service', () => lookups)
vi.mock('@/lib/auth', () => ({ auth: { api: authApi, $context: Promise.resolve({}) } }))
vi.mock('better-auth/plugins', () => ({ getOrgAdapter: () => orgAdapter }))
vi.mock('@/lib/s3', () => ({}))
vi.mock('./notifications', () => ({ notifyAdminsOfNewMember: vi.fn() }))

const { completeOnboarding } = await import('./actions')

const PROFILE = {
  firstName: 'Ada',
  middleInitial: '',
  lastName: 'Lovelace',
  preferredName: '',
  phone: '',
  dateOfBirth: '',
  jobTitle: 'Data Analyst',
  teamId: 'team-it',
  employmentType: 'Full-time',
  startDate: '2026-01-05',
  photoKey: 'users/user-1/photo.jpg',
  confirmed: true,
}

describe('completeOnboarding', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    guard.requireSession.mockResolvedValue({ user: { id: 'user-1', ihpId: null } })
    prisma.team.findUnique.mockResolvedValue({ id: 'team-it', name: 'IT', organizationId: 'org-1' })
    lookups.isKnownOption.mockResolvedValue(true)
    prisma.user.update.mockResolvedValue({})
  })

  it('joins an invited member to their department without needing admin rights', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'member-1' })
    orgAdapter.findOrCreateTeamMember.mockResolvedValue({ id: 'team-member-1' })

    expect(await completeOnboarding(PROFILE)).toEqual({ ok: true })

    expect(orgAdapter.findOrCreateTeamMember).toHaveBeenCalledWith({
      teamId: 'team-it',
      userId: 'user-1',
    })
    expect(authApi.addTeamMember).not.toHaveBeenCalled()
    expect(prisma.user.update).toHaveBeenCalled()
  })

  it('adds someone new to the organization and the department together', async () => {
    prisma.member.findFirst.mockResolvedValue(null)
    authApi.addMember.mockResolvedValue({})

    expect(await completeOnboarding(PROFILE)).toEqual({ ok: true })

    expect(authApi.addMember).toHaveBeenCalledWith({
      body: { userId: 'user-1', role: 'member', organizationId: 'org-1', teamId: 'team-it' },
    })
  })

  it('leaves the profile unfinished when the department join fails', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'member-1' })
    orgAdapter.findOrCreateTeamMember.mockRejectedValue(new Error('connection reset'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await completeOnboarding(PROFILE)).toEqual({
      ok: false,
      message: 'Could not join that department — try again in a moment.',
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
