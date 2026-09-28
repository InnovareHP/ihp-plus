// @vitest-environment node
import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { organization } from 'better-auth/plugins'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invitationGuard, invitationRefusal, organizationAccess } from './invitation-policy'

// A real Better Auth, on its own in-memory store: this runs the invite and accept endpoints
// themselves, not a mock of them, with the same roles and guard the portal uses.
type Row = Record<string, unknown>

function freshStore(): Record<string, Row[]> {
  return {
    user: [],
    session: [],
    account: [],
    verification: [],
    organization: [],
    member: [],
    invitation: [],
    team: [],
    teamMember: [],
  }
}

let store = freshStore()
let hrTeamId = ''
const sentInvitations = vi.fn()

function makeAuth() {
  return betterAuth({
    baseURL: 'http://portal.test',
    secret: 'a-test-secret-that-is-long-enough-for-better-auth',
    database: memoryAdapter(store),
    emailAndPassword: { enabled: true },
    hooks: {
      before: invitationGuard(async (userId, organizationId) => {
        const member = store.member?.find(
          (row) => row.userId === userId && row.organizationId === organizationId,
        )
        if (!member) return null
        const isHr = Boolean(
          store.teamMember?.find((row) => row.userId === userId && row.teamId === hrTeamId),
        )
        return { role: String(member.role), isHr }
      }),
    },
    plugins: [
      organization({
        ...organizationAccess,
        teams: { enabled: true, defaultTeam: { enabled: false } },
        sendInvitationEmail: async (data) => sentInvitations(data),
      }),
    ],
  })
}

type Auth = ReturnType<typeof makeAuth>

async function signUp(auth: Auth, email: string) {
  const { headers, response } = await auth.api.signUpEmail({
    body: { email, password: 'correct-horse-battery', name: email.split('@')[0] ?? email },
    returnHeaders: true,
  })
  const cookie = headers
    .getSetCookie()
    .map((line) => line.split(';')[0])
    .join('; ')
  return { userId: response.user.id, headers: new Headers({ cookie }) }
}

let auth: Auth
let organizationId = ''
let careTeamId = ''
let owner: Awaited<ReturnType<typeof signUp>>
let hr: Awaited<ReturnType<typeof signUp>>
let clerk: Awaited<ReturnType<typeof signUp>>

beforeEach(async () => {
  store = freshStore()
  sentInvitations.mockReset()
  auth = makeAuth()

  owner = await signUp(auth, 'owner@ihp.test')
  const org = await auth.api.createOrganization({
    body: { name: 'IHP+', slug: 'ihp' },
    headers: owner.headers,
  })
  organizationId = org?.id ?? ''

  const hrTeam = await auth.api.createTeam({
    body: { name: 'People & Culture', organizationId },
    headers: owner.headers,
  })
  const careTeam = await auth.api.createTeam({
    body: { name: 'Care Management', organizationId },
    headers: owner.headers,
  })
  hrTeamId = hrTeam.id
  careTeamId = careTeam.id

  hr = await signUp(auth, 'rita@ihp.test')
  await auth.api.addMember({
    body: { userId: hr.userId, organizationId, role: 'member', teamId: hrTeamId },
  })
  clerk = await signUp(auth, 'clerk@ihp.test')
  await auth.api.addMember({
    body: { userId: clerk.userId, organizationId, role: 'member', teamId: careTeamId },
  })
})

function invite(
  as: { headers: Headers },
  body: { email: string; role: 'member' | 'admin'; resend?: boolean },
) {
  return auth.api.createInvitation({
    body: { ...body, organizationId, teamId: careTeamId },
    headers: as.headers,
  })
}

describe('hiring an applicant through Better Auth', () => {
  it('lets HR invite, emails the link, and the applicant joins the department on accepting', async () => {
    const invitation = await invite(hr, { email: 'Grace@Example.com', role: 'member' })

    expect(invitation).toMatchObject({
      email: 'grace@example.com',
      role: 'member',
      status: 'pending',
    })
    expect(sentInvitations).toHaveBeenCalledWith(
      expect.objectContaining({ id: invitation.id, email: 'grace@example.com' }),
    )

    const grace = await signUp(auth, 'grace@example.com')
    await auth.api.acceptInvitation({
      body: { invitationId: invitation.id },
      headers: grace.headers,
    })

    expect(store.member?.find((row) => row.userId === grace.userId)).toMatchObject({
      organizationId,
      role: 'member',
    })
    expect(
      store.teamMember?.find((row) => row.userId === grace.userId && row.teamId === careTeamId),
    ).toBeDefined()
    expect(store.invitation?.find((row) => row.id === invitation.id)?.status).toBe('accepted')
  })

  it('refuses the invitation to anyone but the invited address', async () => {
    const invitation = await invite(hr, { email: 'grace@example.com', role: 'member' })
    const stranger = await signUp(auth, 'stranger@example.com')

    await expect(
      auth.api.acceptInvitation({
        body: { invitationId: invitation.id },
        headers: stranger.headers,
      }),
    ).rejects.toThrow()
    expect(store.member?.find((row) => row.userId === stranger.userId)).toBeUndefined()
  })

  it('refreshes one invitation when HR hires the same person again', async () => {
    const first = await invite(hr, { email: 'grace@example.com', role: 'member' })
    const again = await invite(hr, { email: 'grace@example.com', role: 'member', resend: true })

    expect(again.id).toBe(first.id)
    expect(store.invitation).toHaveLength(1)
    expect(sentInvitations).toHaveBeenCalledTimes(2)
  })

  it('does not let HR invite anyone as an admin', async () => {
    await expect(invite(hr, { email: 'grace@example.com', role: 'admin' })).rejects.toThrow(
      'HR can invite people as members only.',
    )
    expect(store.invitation).toHaveLength(0)
  })

  it('refuses a member outside HR, the resend path included', async () => {
    await expect(invite(clerk, { email: 'grace@example.com', role: 'member' })).rejects.toThrow(
      'Only admins and HR can invite people to this organization.',
    )

    await invite(hr, { email: 'grace@example.com', role: 'member' })
    await expect(
      invite(clerk, { email: 'grace@example.com', role: 'member', resend: true }),
    ).rejects.toThrow('Only admins and HR can invite people to this organization.')
    expect(sentInvitations).toHaveBeenCalledTimes(1)
  })

  it('still lets the owner invite at any role below owner', async () => {
    const invitation = await invite(owner, { email: 'new-admin@ihp.test', role: 'admin' })

    expect(invitation.role).toBe('admin')
  })
})

describe('invitationRefusal', () => {
  it('reads a member row holding several roles', () => {
    expect(invitationRefusal({ role: 'member, admin', isHr: false }, ['admin'])).toBeNull()
    expect(invitationRefusal(null, ['member'])).toBe(
      'Only a member of this organization can invite people to it.',
    )
  })
})
