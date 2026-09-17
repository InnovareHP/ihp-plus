'use server'

import { db } from '@ihp/db'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { ORGANIZATION_ROLES } from '@/features/members/schema'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import {
  assignDepartmentSchema,
  createTeamSchema,
  deleteTeamSchema,
  invitationIdSchema,
  inviteMemberSchema,
  organizationProfileSchema,
  removeFromTeamSchema,
  renameTeamSchema,
  type AssignableUserRow,
  type InvitationRow,
  type InvitationStatus,
  type OrganizationSummary,
  type TeamPersonRow,
  type TeamRow,
} from './schema'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }
export type MutateResult = { ok: true } | { ok: false; message: string }

const FORBIDDEN = 'You do not have permission to manage this organization.'

// The plugin endpoints enforce their own authorization from the caller's session; this decides
// who may reach the screens at all, so an ordinary member never gets a list to act on.
async function requireManager() {
  const { user, profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  return {
    userId: user.id,
    organizationId: membership.organizationId,
    canManage: canManageOrganization(membership),
  }
}

// Better Auth throws APIError, whose readable text sits on message; anything else is unknown.
function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export async function getOrganizationSummary(): Promise<Result<OrganizationSummary>> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      _count: { select: { members: true, teams: true } },
    },
  })
  if (!organization) return { ok: false, message: 'This organization no longer exists.' }

  const [pendingInvitationCount, unassignedCount] = await Promise.all([
    db.invitation.count({ where: { organizationId, status: 'pending' } }),
    db.member.count({ where: { organizationId, user: { teammembers: { none: {} } } } }),
  ])

  return {
    ok: true,
    data: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo ?? '',
      memberCount: organization._count.members,
      teamCount: organization._count.teams,
      pendingInvitationCount,
      unassignedCount,
    },
  }
}

export async function updateOrganizationProfile(input: unknown): Promise<MutateResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const parsed = organizationProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields and try again.' }

  const taken = await db.organization.findFirst({
    where: { slug: parsed.data.slug, NOT: { id: organizationId } },
    select: { id: true },
  })
  if (taken) return { ok: false, message: 'That slug is already in use — pick another.' }

  try {
    await auth.api.updateOrganization({
      body: {
        organizationId,
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          logo: parsed.data.logo === '' ? null : parsed.data.logo,
        },
      },
      headers: await headers(),
    })
  } catch (error) {
    return { ok: false, message: messageOf(error, 'Could not save the organization — try again.') }
  }

  return { ok: true }
}

export async function listTeams(): Promise<Result<TeamRow[]>> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const teams = await db.team.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, createdAt: true, _count: { select: { teammembers: true } } },
  })

  return {
    ok: true,
    data: teams.map((team) => ({
      id: team.id,
      name: team.name,
      memberCount: team._count.teammembers,
      createdAt: team.createdAt.toISOString(),
    })),
  }
}

export async function createTeam(input: unknown): Promise<MutateResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const parsed = createTeamSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Give the department a name of 2–60 letters.' }

  if (await nameTaken(organizationId, parsed.data.name)) {
    return { ok: false, message: 'A department with that name already exists.' }
  }

  try {
    await auth.api.createTeam({
      body: { name: parsed.data.name, organizationId },
      headers: await headers(),
    })
  } catch (error) {
    return { ok: false, message: messageOf(error, 'Could not create that department — try again.') }
  }

  return { ok: true }
}

export async function renameTeam(input: unknown): Promise<MutateResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const parsed = renameTeamSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Give the department a name of 2–60 letters.' }

  if (await nameTaken(organizationId, parsed.data.name, parsed.data.teamId)) {
    return { ok: false, message: 'A department with that name already exists.' }
  }

  try {
    await auth.api.updateTeam({
      body: { teamId: parsed.data.teamId, data: { name: parsed.data.name } },
      headers: await headers(),
    })
  } catch (error) {
    return { ok: false, message: messageOf(error, 'Could not rename that department — try again.') }
  }

  return { ok: true }
}

export async function deleteTeam(input: unknown): Promise<MutateResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const parsed = deleteTeamSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That request was not valid.' }

  // Deleting would strip everyone in it of the department the rest of the portal reads.
  const occupied = await db.teamMember.count({ where: { teamId: parsed.data.teamId } })
  if (occupied > 0) {
    const people = occupied === 1 ? 'person' : 'people'
    return {
      ok: false,
      message: `Move the ${occupied} ${people} in this department somewhere else first.`,
    }
  }

  try {
    await auth.api.removeTeam({
      body: { teamId: parsed.data.teamId, organizationId },
      headers: await headers(),
    })
  } catch (error) {
    return { ok: false, message: messageOf(error, 'Could not delete that department — try again.') }
  }

  return { ok: true }
}

export async function listTeamMembers(teamId: unknown): Promise<Result<TeamPersonRow[]>> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }
  if (typeof teamId !== 'string' || teamId.length === 0) {
    return { ok: false, message: 'That department was not found.' }
  }

  const rows = await db.teamMember.findMany({
    where: { teamId, team: { organizationId } },
    orderBy: { user: { name: 'asc' } },
    select: { user: { select: { id: true, name: true, email: true, jobTitle: true } } },
  })

  return {
    ok: true,
    data: rows.map((row) => ({
      userId: row.user.id,
      name: row.user.name,
      email: row.user.email,
      jobTitle: row.user.jobTitle,
    })),
  }
}

export async function listAssignableUsers(): Promise<Result<AssignableUserRow[]>> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const rows = await db.member.findMany({
    where: { organizationId },
    orderBy: { user: { name: 'asc' } },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          teammembers: { select: { team: { select: { id: true, name: true } } }, take: 1 },
        },
      },
    },
  })

  return {
    ok: true,
    data: rows.map((row) => ({
      userId: row.user.id,
      name: row.user.name,
      email: row.user.email,
      teamId: row.user.teammembers[0]?.team.id,
      teamName: row.user.teammembers[0]?.team.name,
    })),
  }
}

// One department per person is what the dashboard and settings pages read, so assigning is a
// move: every other team membership goes before the new one is written.
export async function assignDepartment(input: unknown): Promise<MutateResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const parsed = assignDepartmentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That request was not valid.' }

  const team = await db.team.findFirst({
    where: { id: parsed.data.teamId, organizationId },
    select: { id: true },
  })
  if (!team) return { ok: false, message: 'That department no longer exists — pick another one.' }

  const current = await db.teamMember.findMany({
    where: { userId: parsed.data.userId, team: { organizationId } },
    select: { teamId: true },
  })
  if (current.some((membership) => membership.teamId === parsed.data.teamId)) return { ok: true }

  const requestHeaders = await headers()

  try {
    for (const membership of current) {
      await auth.api.removeTeamMember({
        body: { teamId: membership.teamId, userId: parsed.data.userId },
        headers: requestHeaders,
      })
    }

    await auth.api.addTeamMember({
      body: { teamId: parsed.data.teamId, userId: parsed.data.userId },
      headers: requestHeaders,
    })
  } catch (error) {
    return { ok: false, message: messageOf(error, 'Could not move that person — try again.') }
  }

  return { ok: true }
}

export async function removeFromTeam(input: unknown): Promise<MutateResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const parsed = removeFromTeamSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That request was not valid.' }

  try {
    await auth.api.removeTeamMember({
      body: { teamId: parsed.data.teamId, userId: parsed.data.userId },
      headers: await headers(),
    })
  } catch (error) {
    return { ok: false, message: messageOf(error, 'Could not remove that person — try again.') }
  }

  return { ok: true }
}

export async function listInvitations(): Promise<Result<InvitationRow[]>> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const rows = await db.invitation.findMany({
    where: { organizationId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      teamId: true,
      expiresAt: true,
      user: { select: { name: true } },
    },
  })

  const teamNames = await teamNameMap(organizationId)
  const now = Date.now()

  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role ?? 'member',
      teamName: row.teamId ? teamNames.get(row.teamId) : undefined,
      status: row.status as InvitationStatus,
      expiresAt: row.expiresAt.toISOString(),
      expired: row.expiresAt.getTime() < now,
      invitedBy: row.user.name,
    })),
  }
}

export async function inviteMember(input: unknown): Promise<MutateResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const parsed = inviteMemberSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields and try again.' }

  const email = parsed.data.email.toLowerCase()
  const alreadyIn = await db.member.findFirst({
    where: { organizationId, user: { email } },
    select: { id: true },
  })
  if (alreadyIn) return { ok: false, message: 'That person is already in this organization.' }

  try {
    await auth.api.createInvitation({
      body: {
        email,
        role: parsed.data.role,
        teamId: parsed.data.teamId,
        organizationId,
        resend: true,
      },
      headers: await headers(),
    })
  } catch (error) {
    return { ok: false, message: messageOf(error, 'Could not send that invitation — try again.') }
  }

  return { ok: true }
}

export async function cancelInvitation(input: unknown): Promise<MutateResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const parsed = invitationIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That request was not valid.' }

  try {
    await auth.api.cancelInvitation({
      body: { invitationId: parsed.data.invitationId },
      headers: await headers(),
    })
  } catch (error) {
    return { ok: false, message: messageOf(error, 'Could not cancel that invitation — try again.') }
  }

  return { ok: true }
}

// Resending is the same create call with resend, which refreshes the expiry and the email.
export async function resendInvitation(input: unknown): Promise<MutateResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const parsed = invitationIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That request was not valid.' }

  const invitation = await db.invitation.findFirst({
    where: { id: parsed.data.invitationId, organizationId },
    select: { email: true, role: true, teamId: true },
  })
  if (!invitation) return { ok: false, message: 'That invitation no longer exists.' }

  // The stored role is a plain column, so it is narrowed back to the plugin's union here.
  const role = ORGANIZATION_ROLES.find((candidate) => candidate === invitation.role) ?? 'member'

  try {
    await auth.api.createInvitation({
      body: {
        email: invitation.email,
        role,
        teamId: invitation.teamId ?? undefined,
        organizationId,
        resend: true,
      },
      headers: await headers(),
    })
  } catch (error) {
    return { ok: false, message: messageOf(error, 'Could not resend that invitation — try again.') }
  }

  return { ok: true }
}

// team has no unique constraint on (organizationId, name), so duplicates are caught here.
async function nameTaken(organizationId: string, name: string, exceptTeamId?: string) {
  const existing = await db.team.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptTeamId ? { NOT: { id: exceptTeamId } } : {}),
    },
    select: { id: true },
  })
  return Boolean(existing)
}

async function teamNameMap(organizationId: string) {
  const teams = await db.team.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  })
  return new Map(teams.map((team) => [team.id, team.name]))
}
