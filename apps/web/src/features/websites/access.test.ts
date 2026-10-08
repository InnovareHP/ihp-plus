import { describe, expect, it, vi } from 'vitest'

vi.mock('@ihp/db', () => ({ db: {} }))
vi.mock('@/features/teams/leads', () => ({ isTeamLead: vi.fn() }))
vi.mock('@/lib/auth-guard', () => ({
  canManageOrganization: (membership: { organizationRole?: string }) =>
    membership.organizationRole === 'admin',
  membershipOf: vi.fn(),
  requireOnboarded: vi.fn(),
}))

const { websitesRoleOf } = await import('./access')

function member(teamId: string | undefined, organizationRole = 'member') {
  return {
    portalRole: 'user',
    organizationRole,
    organizationId: 'org-1',
    organization: undefined,
    team: teamId ? { id: teamId, name: teamId } : undefined,
  }
}

describe('websitesRoleOf', () => {
  it('shows the page to IT members but leaves the checks to the lead', () => {
    expect(websitesRoleOf(member('it'), 'it', false)).toMatchObject({
      canView: true,
      canCheck: false,
      canManage: false,
    })
    expect(websitesRoleOf(member('it'), 'it', true)).toMatchObject({
      canView: true,
      canCheck: true,
      canManage: true,
    })
  })

  it('hides the page from every other department', () => {
    expect(websitesRoleOf(member('finance'), 'it', false).canView).toBe(false)
    expect(websitesRoleOf(member(undefined), 'it', false).canView).toBe(false)
  })

  it('hides it from everyone but admins until an IT department is picked', () => {
    expect(websitesRoleOf(member('it'), undefined, false).canView).toBe(false)
    expect(websitesRoleOf(member(undefined, 'admin'), undefined, false)).toMatchObject({
      canView: true,
      canConfigure: true,
      canCheck: false,
    })
  })
})
