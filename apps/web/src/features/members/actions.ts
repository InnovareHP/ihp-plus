'use server'

import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { headers } from 'next/headers'
import { EMPLOYMENT_TYPES } from '@/features/onboarding/options'
import { auth } from '@/lib/auth'
import { requireOnboarded } from '@/lib/auth-guard'
import { pageInfoOf, skipTake, type SortDirection } from '@/lib/pagination'
import {
  memberQuerySchema,
  setBannedSchema,
  setOrganizationRoleSchema,
  setPortalRoleSchema,
  type MemberFilterOptions,
  type MemberQuery,
  type MemberSortKey,
  type MembersPage,
  type OrganizationRole,
  type PortalRole,
} from './schema'

export type MembersResult = ({ ok: true } & MembersPage) | { ok: false; message: string }
export type FilterOptionsResult =
  { ok: true; options: MemberFilterOptions } | { ok: false; message: string }
export type MutateResult = { ok: true } | { ok: false; message: string }

const FORBIDDEN = 'You do not have permission to manage members.'

// The plugins enforce their own authorization from the caller's session; this only decides
// who may see the page at all, so an ordinary member never gets a list to act on.
async function requireManager() {
  const { user, profile } = await requireOnboarded()
  const organizationRole = profile.members[0]?.role
  const canManage =
    profile.role === 'admin' || organizationRole === 'owner' || organizationRole === 'admin'
  return { user, profile, canManage, organizationId: profile.members[0]?.organizationId }
}

const SEARCH_FIELDS = ['name', 'email', 'jobTitle', 'ihpId'] as const

function userFilterOf(query: MemberQuery): Prisma.UserWhereInput | undefined {
  const clauses: Prisma.UserWhereInput[] = []

  if (query.search) {
    clauses.push({
      OR: SEARCH_FIELDS.map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      })),
    })
  }

  if (query.portalRoles.length > 0) {
    // A null role is an ordinary member, so filtering for 'user' has to match it too.
    const roles: Prisma.UserWhereInput[] = [{ role: { in: query.portalRoles } }]
    if (query.portalRoles.includes('user')) roles.push({ role: null })
    clauses.push({ OR: roles })
  }

  if (query.status === 'suspended') clauses.push({ banned: true })
  // Nullable column: an account that was never banned holds null, not false.
  if (query.status === 'active') clauses.push({ OR: [{ banned: false }, { banned: null }] })

  if (query.employmentTypes.length > 0) {
    clauses.push({ employmentType: { in: [...query.employmentTypes] } })
  }

  if (query.teamIds.length > 0) {
    clauses.push({ teammembers: { some: { teamId: { in: query.teamIds } } } })
  }

  if (query.startDateFrom || query.startDateTo) {
    clauses.push({
      startDate: {
        ...(query.startDateFrom ? { gte: new Date(`${query.startDateFrom}T00:00:00.000Z`) } : {}),
        ...(query.startDateTo ? { lte: new Date(`${query.startDateTo}T23:59:59.999Z`) } : {}),
      },
    })
  }

  return clauses.length > 0 ? { AND: clauses } : undefined
}

const ORDER_BY: Record<
  MemberSortKey,
  (direction: SortDirection) => Prisma.MemberOrderByWithRelationInput
> = {
  name: (direction) => ({ user: { name: direction } }),
  email: (direction) => ({ user: { email: direction } }),
  jobTitle: (direction) => ({ user: { jobTitle: direction } }),
  startDate: (direction) => ({ user: { startDate: direction } }),
  portalRole: (direction) => ({ user: { role: direction } }),
  organizationRole: (direction) => ({ role: direction }),
  createdAt: (direction) => ({ createdAt: direction }),
}

export async function listMembers(input?: unknown): Promise<MembersResult> {
  const { user, canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const query = memberQuerySchema.parse(input ?? {})
  const where: Prisma.MemberWhereInput = { organizationId, user: userFilterOf(query) }

  const total = await db.member.count({ where })
  // Counted first so a stale ?page= past the end lands on the last page instead of a blank table.
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })

  const rows = await db.member.findMany({
    where,
    // The second key is the tiebreaker: without it equal values reshuffle between pages.
    orderBy: [ORDER_BY[query.sortBy](query.sortDirection), { id: 'asc' }],
    ...skipTake(pageInfo),
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
          jobTitle: true,
          ihpId: true,
          startDate: true,
          teammembers: { select: { team: { select: { name: true } } }, take: 1 },
        },
      },
    },
  })

  return {
    ok: true,
    pageInfo,
    rows: rows.map((row) => ({
      memberId: row.id,
      userId: row.user.id,
      name: row.user.name,
      email: row.user.email,
      organizationRole: row.role as OrganizationRole,
      portalRole: (row.user.role ?? 'user') as PortalRole,
      team: row.user.teammembers[0]?.team.name,
      jobTitle: row.user.jobTitle ?? undefined,
      ihpId: row.user.ihpId ?? undefined,
      startDate: row.user.startDate?.toISOString(),
      banned: row.user.banned ?? false,
      isSelf: row.user.id === user.id,
    })),
  }
}

/** Department options for the filter panel; the other filters come from constants. */
export async function listMemberFilterOptions(): Promise<FilterOptionsResult> {
  const { canManage, organizationId } = await requireManager()
  if (!canManage || !organizationId) return { ok: false, message: FORBIDDEN }

  const teams = await db.team.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, _count: { select: { teammembers: true } } },
  })

  return {
    ok: true,
    options: {
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        memberCount: team._count.teammembers,
      })),
      employmentTypes: EMPLOYMENT_TYPES,
    },
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
