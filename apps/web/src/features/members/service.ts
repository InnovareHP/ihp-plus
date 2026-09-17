import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { isKnownOption, listFor } from '@/features/lookups/service'
import { canManageOrganization, getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { pageInfoOf, skipTake, type SortDirection } from '@/lib/pagination'
import type {
  MemberFilterOptions,
  MemberQuery,
  MemberRow,
  MemberSortKey,
  MembersPage,
  OrganizationRole,
  PortalRole,
  SetBannedValues,
  SetEmploymentStatusValues,
  SetOrganizationRoleValues,
  SetPortalRoleValues,
} from './schema'

// Deliberately not requireOnboarded(): that redirects, and a redirect thrown inside an RPC
// surfaces as an opaque 500 rather than a code the caller can act on. The session still comes
// from cookies, because the service runs in the same process as the app; lifting it out is
// where a transport interceptor would carry a token instead.
async function requireManager() {
  const session = await getSession()
  if (!session) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const profile = await readProfile(session.user.id)
  if (!profile) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const membership = membershipOf(profile)
  if (!canManageOrganization(membership) || !membership.organizationId) {
    throw new ConnectError('You do not have permission to manage members.', Code.PermissionDenied)
  }

  return { user: session.user, organizationId: membership.organizationId }
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

  if (query.employmentStatuses.length > 0) {
    clauses.push({ employmentStatus: { in: [...query.employmentStatuses] } })
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

const ROW_SELECT = {
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
      employmentStatus: true,
      startDate: true,
      teammembers: { select: { team: { select: { name: true } } }, take: 1 },
    },
  },
} satisfies Prisma.MemberSelect

type MemberRecord = Prisma.MemberGetPayload<{ select: typeof ROW_SELECT }>

function rowOf(row: MemberRecord, callerId: string): MemberRow {
  return {
    memberId: row.id,
    userId: row.user.id,
    name: row.user.name,
    email: row.user.email,
    organizationRole: row.role as OrganizationRole,
    portalRole: (row.user.role ?? 'user') as PortalRole,
    team: row.user.teammembers[0]?.team.name,
    jobTitle: row.user.jobTitle ?? undefined,
    ihpId: row.user.ihpId ?? undefined,
    employmentStatus: row.user.employmentStatus ?? undefined,
    startDate: row.user.startDate?.toISOString(),
    banned: row.user.banned ?? false,
    isSelf: row.user.id === callerId,
  }
}

export async function loadMembersPage(query: MemberQuery): Promise<MembersPage> {
  const { user, organizationId } = await requireManager()
  const where: Prisma.MemberWhereInput = { organizationId, user: userFilterOf(query) }

  const total = await db.member.count({ where })
  // Counted first so a stale page past the end lands on the last page, not a blank table.
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })

  const rows = await db.member.findMany({
    where,
    // The second key is the tiebreaker: without it equal values reshuffle between pages.
    orderBy: [ORDER_BY[query.sortBy](query.sortDirection), { id: 'asc' }],
    ...skipTake(pageInfo),
    select: ROW_SELECT,
  })

  return { pageInfo, rows: rows.map((row) => rowOf(row, user.id)) }
}

/** Department options for the filter panel; the other filters come from constants. */
export async function loadFilterOptions(): Promise<MemberFilterOptions> {
  const { organizationId } = await requireManager()

  const [teams, employmentTypes, employmentStatuses] = await Promise.all([
    db.team.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { teammembers: true } } },
    }),
    listFor(organizationId, 'employmentType'),
    listFor(organizationId, 'employmentStatus'),
  ])

  return {
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      memberCount: team._count.teammembers,
    })),
    employmentTypes: employmentTypes.map((option) => option.value),
    employmentStatuses: employmentStatuses.map((option) => option.value),
  }
}

// Re-read so the response carries what the server holds, not what the caller asked for.
async function reload(where: Prisma.MemberWhereInput, callerId: string): Promise<MemberRow> {
  const row = await db.member.findFirst({ where, select: ROW_SELECT })
  if (!row) throw new ConnectError('That member no longer exists.', Code.NotFound)
  return rowOf(row, callerId)
}

export async function applyOrganizationRole(values: SetOrganizationRoleValues): Promise<MemberRow> {
  const { user, organizationId } = await requireManager()

  try {
    await auth.api.updateMemberRole({
      body: { memberId: values.memberId, role: values.role, organizationId },
      headers: await headers(),
    })
  } catch {
    throw new ConnectError('Could not change that organization role — try again.', Code.Internal)
  }

  return reload({ id: values.memberId, organizationId }, user.id)
}

export async function applyPortalRole(values: SetPortalRoleValues): Promise<MemberRow> {
  const { user, organizationId } = await requireManager()

  // Removing your own admin rights would lock you out of this page with no way back.
  if (values.userId === user.id && values.role !== 'admin') {
    throw new ConnectError('You cannot remove your own portal admin role.', Code.FailedPrecondition)
  }

  try {
    await auth.api.setRole({
      body: { userId: values.userId, role: values.role },
      headers: await headers(),
    })
  } catch {
    throw new ConnectError('Could not change that portal role — try again.', Code.Internal)
  }

  return reload({ userId: values.userId, organizationId }, user.id)
}

export async function applyEmploymentStatus(values: SetEmploymentStatusValues): Promise<MemberRow> {
  const { user, organizationId } = await requireManager()

  const inOrganization = await db.member.findFirst({
    where: { organizationId, userId: values.userId },
    select: { id: true },
  })
  if (!inOrganization) {
    throw new ConnectError('That person is not in this organization.', Code.NotFound)
  }

  // The curated list is the trust boundary; an empty value clears the status instead.
  if (values.employmentStatus) {
    const known = await isKnownOption(organizationId, 'employmentStatus', values.employmentStatus)
    if (!known) {
      throw new ConnectError(
        'That is not one of the employment statuses this organization keeps.',
        Code.InvalidArgument,
      )
    }
  }

  await db.user.update({
    where: { id: values.userId },
    data: { employmentStatus: values.employmentStatus || null },
  })

  return reload({ userId: values.userId, organizationId }, user.id)
}

export async function applyMemberAccess(values: SetBannedValues): Promise<MemberRow> {
  const { user, organizationId } = await requireManager()

  if (values.userId === user.id) {
    throw new ConnectError('You cannot ban your own account.', Code.FailedPrecondition)
  }

  const requestHeaders = await headers()

  try {
    if (values.banned) {
      await auth.api.banUser({ body: { userId: values.userId }, headers: requestHeaders })
    } else {
      await auth.api.unbanUser({ body: { userId: values.userId }, headers: requestHeaders })
    }
  } catch {
    throw new ConnectError('Could not change that access level — try again.', Code.Internal)
  }

  return reload({ userId: values.userId, organizationId }, user.id)
}
