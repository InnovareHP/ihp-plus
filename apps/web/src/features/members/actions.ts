'use server'

import { db } from '@ihp/db'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { requireOnboarded } from '@/lib/auth-guard'
import {
  setBannedSchema,
  setOrganizationRoleSchema,
  setPortalRoleSchema,
  type MemberRow,
  type OrganizationRole,
  type PortalRole,
} from './schema'

export type MembersResult = { ok: true; members: MemberRow[] } | { ok: false; message: string }
export type MutateResult = { ok: true } | { ok: false; message: string }

const FORBIDDEN = 'You do not have permission to manage members.'

// The plugins enforce their own authorization from the caller's session; this only decides
// who may see the page at all, so an ordinary member never gets a list to act on.
async function requireManager() {
  const { user, profile } = await requireOnboarded()
  const organizationRole = profile.members[0]?.role
  const canManage = profile.role === 'admin' || organizationRole === 'owner' || organizationRole === 'admin'
  return { user, profile, canManage, organizationId: profile.members[0]?.organizationId }
}

export async function listMembers(): Promise<MembersResult> {
  const { user, canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const rows = await db.member.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          banned: true,
          teammembers: { select: { team: { select: { name: true } } }, take: 1 },
        },
      },
    },
  })

  return {
    ok: true,
    members: rows.map((row) => ({
      memberId: row.id,
      userId: row.user.id,
      name: row.user.name,
      email: row.user.email,
      organizationRole: row.role as OrganizationRole,
      portalRole: (row.user.role ?? 'user') as PortalRole,
      team: row.user.teammembers[0]?.team.name,
      banned: row.user.banned ?? false,
      isSelf: row.user.id === user.id,
    })),
  }
}

export async function setOrganizationRole(input: unknown): Promise<MutateResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const parsed = setOrganizationRoleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That role is not one of the allowed values.' }

  try {
    await auth.api.updateMemberRole({
      body: { memberId: parsed.data.memberId, role: parsed.data.role, organizationId },
      headers: await headers(),
    })
  } catch {
    return { ok: false, message: 'Could not change that organization role — try again.' }
  }

  return { ok: true }
}

export async function setPortalRole(input: unknown): Promise<MutateResult> {
  const { user, canManage } = await requireManager()
  if (!canManage) return { ok: false, message: FORBIDDEN }

  const parsed = setPortalRoleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That role is not one of the allowed values.' }

  // Removing your own admin rights would lock you out of this page with no way back.
  if (parsed.data.userId === user.id && parsed.data.role !== 'admin') {
    return { ok: false, message: 'You cannot remove your own portal admin role.' }
  }

  try {
    await auth.api.setRole({
      body: { userId: parsed.data.userId, role: parsed.data.role },
      headers: await headers(),
    })
  } catch {
    return { ok: false, message: 'Could not change that portal role — try again.' }
  }

  return { ok: true }
}

export async function setBanned(input: unknown): Promise<MutateResult> {
  const { user, canManage } = await requireManager()
  if (!canManage) return { ok: false, message: FORBIDDEN }

  const parsed = setBannedSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That request was not valid.' }

  if (parsed.data.userId === user.id) {
    return { ok: false, message: 'You cannot ban your own account.' }
  }

  const requestHeaders = await headers()

  try {
    if (parsed.data.banned) {
      await auth.api.banUser({ body: { userId: parsed.data.userId }, headers: requestHeaders })
    } else {
      await auth.api.unbanUser({ body: { userId: parsed.data.userId }, headers: requestHeaders })
    }
  } catch {
    return { ok: false, message: 'Could not change that account’s access — try again.' }
  }

  return { ok: true }
}
