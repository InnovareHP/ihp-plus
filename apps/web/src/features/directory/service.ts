import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { pageInfoOf, skipTake } from '@/lib/pagination'
import { isObjectStorageConfigured, objectUrl } from '@/lib/s3'
import {
  directoryQuerySchema,
  UNASSIGNED,
  type DirectoryDepartments,
  type DirectoryPage,
  type DirectoryQuery,
  type PersonRow,
} from './schema'

// The directory is the company looking itself up, so every onboarded member reads it in full.
// It carries no more than a colleague already shares at onboarding, and nothing is writable.
async function caller() {
  const { profile } = await requireOnboarded()
  const membership = membershipOf(profile)

  if (!membership.organizationId) {
    throw new ConnectError(
      'Your account is not part of an organization yet.',
      Code.FailedPrecondition,
    )
  }

  return { organizationId: membership.organizationId }
}

const SEARCH_FIELDS = ['name', 'preferredName', 'jobTitle', 'email', 'phone', 'ihpId'] as const

function whereOf(organizationId: string, query: DirectoryQuery): Prisma.MemberWhereInput {
  const user: Prisma.UserWhereInput[] = []

  if (query.search) {
    user.push({
      OR: SEARCH_FIELDS.map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      })),
    })
  }

  if (query.teamIds.length > 0) {
    // 'unassigned' is a filter value, not an id: someone with no department at all.
    const ids = query.teamIds.filter((id) => id !== UNASSIGNED)
    const clauses: Prisma.UserWhereInput[] = []
    if (ids.length > 0) clauses.push({ teammembers: { some: { teamId: { in: ids } } } })
    if (query.teamIds.includes(UNASSIGNED)) clauses.push({ teammembers: { none: {} } })
    user.push({ OR: clauses })
  }

  return {
    organizationId,
    // Someone mid-onboarding has no job title or department yet, so they are not listed.
    user: { onboardingCompletedAt: { not: null }, ...(user.length > 0 ? { AND: user } : {}) },
  }
}

/** One lookup for the page rather than a join, because leads live in another Postgres schema. */
async function leadUserIds(organizationId: string, userIds: readonly string[]) {
  if (userIds.length === 0) return new Set<string>()

  const leads = await db.teamLead.findMany({
    where: { organizationId, userId: { in: [...userIds] } },
    select: { userId: true },
  })
  return new Set(leads.map((lead) => lead.userId))
}

export async function loadDirectoryPage(input: unknown): Promise<DirectoryPage> {
  const { organizationId } = await caller()
  const query = directoryQuerySchema.parse(input ?? {})
  const where = whereOf(organizationId, query)

  const total = await db.member.count({ where })
  // Counted first so a stale ?page= past the end lands on the last page instead of a blank list.
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })

  const members = await db.member.findMany({
    where,
    // The second key is the tiebreaker: without it equal names reshuffle between pages.
    orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
    ...skipTake(pageInfo),
    select: {
      user: {
        select: {
          id: true,
          name: true,
          preferredName: true,
          jobTitle: true,
          email: true,
          phone: true,
          ihpId: true,
          employmentType: true,
          photoKey: true,
          startDate: true,
          teammembers: { select: { team: { select: { name: true } } }, take: 1 },
        },
      },
    },
  })

  const leads = await leadUserIds(
    organizationId,
    members.map((member) => member.user.id),
  )
  const storageReady = isObjectStorageConfigured()

  const rows: PersonRow[] = await Promise.all(
    members.map(async (member) => {
      const person = member.user

      return {
        userId: person.id,
        // Preferred name when there is one, so people are listed as they are addressed.
        name: person.preferredName ?? person.name,
        jobTitle: person.jobTitle ?? '',
        department: person.teammembers[0]?.team.name ?? '',
        email: person.email,
        phone: person.phone ?? '',
        ihpId: person.ihpId ?? '',
        employmentType: person.employmentType ?? '',
        photoUrl: person.photoKey && storageReady ? await objectUrl(person.photoKey) : '',
        startDate: person.startDate?.toISOString() ?? '',
        isLead: leads.has(person.id),
      }
    }),
  )

  return { rows, pageInfo }
}

export async function loadDepartments(): Promise<DirectoryDepartments> {
  const { organizationId } = await caller()

  const [teams, unassignedCount] = await Promise.all([
    db.team.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { teammembers: true } } },
    }),
    db.member.count({
      where: {
        organizationId,
        user: { onboardingCompletedAt: { not: null }, teammembers: { none: {} } },
      },
    }),
  ])

  return {
    departments: teams.map((team) => ({
      teamId: team.id,
      name: team.name,
      memberCount: team._count.teammembers,
    })),
    unassignedCount,
  }
}
