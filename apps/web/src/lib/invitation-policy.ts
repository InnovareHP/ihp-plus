import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { createAccessControl } from 'better-auth/plugins/access'
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access'

const INVITE_PATH = '/organization/invite-member'

const ac = createAccessControl(defaultStatements)

/**
 * Members hold invitation:create so HR, who hire as ordinary members, can invite through Better
 * Auth itself; who among them may actually invite is decided by the guard below, not the role.
 */
export const organizationAccess = {
  ac,
  roles: {
    owner: ac.newRole(ownerAc.statements),
    admin: ac.newRole(adminAc.statements),
    member: ac.newRole({ ...memberAc.statements, invitation: ['create'] }),
  },
}

export interface Inviter {
  /** The member row's role, possibly several joined by commas. */
  role: string
  /** Whether they belong to the department hiring settings name as HR. */
  isHr: boolean
}

export type InviterLookup = (userId: string, organizationId: string) => Promise<Inviter | null>

/** Null when the invitation may go ahead, otherwise the sentence the caller reads. */
export function invitationRefusal(inviter: Inviter | null, requestedRoles: readonly string[]) {
  if (!inviter) return 'Only a member of this organization can invite people to it.'
  const roles = inviter.role.split(',').map((role) => role.trim())
  if (roles.includes('owner') || roles.includes('admin')) return null
  if (!inviter.isHr) return 'Only admins and HR can invite people to this organization.'
  // HR brings people in as members; a higher role is still an admin's call.
  if (requestedRoles.some((role) => role !== 'member')) {
    return 'HR can invite people as members only.'
  }
  return null
}

function rolesOf(value: unknown) {
  const list = Array.isArray(value) ? value : [value]
  return list
    .flatMap((role) => (typeof role === 'string' ? role.split(',') : []))
    .map((role) => role.trim())
    .filter(Boolean)
}

/**
 * Runs before every invite-member call, the resend path included, which Better Auth's own
 * beforeCreateInvitation hook never reaches.
 */
export function invitationGuard(lookup: InviterLookup) {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path !== INVITE_PATH) return

    const session = await getSessionFromCtx(ctx)
    // No session is Better Auth's own 401 to give, further on.
    if (!session) return

    const body = (ctx.body ?? {}) as { organizationId?: unknown; role?: unknown }
    const organizationId =
      typeof body.organizationId === 'string'
        ? body.organizationId
        : session.session.activeOrganizationId
    if (typeof organizationId !== 'string' || !organizationId) return

    const refusal = invitationRefusal(
      await lookup(session.user.id, organizationId),
      rolesOf(body.role),
    )
    if (refusal) throw new APIError('FORBIDDEN', { message: refusal })
  })
}
