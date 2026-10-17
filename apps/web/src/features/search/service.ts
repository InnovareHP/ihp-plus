import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { canManageOrganization, getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { profilePhotoUrl } from '@/lib/profile-photo'
import { taskSearchSchema, type SearchDirectory, type SearchTask } from './schema'
import { rankTasks, taskNumberOf } from './utils/rank-tasks'

// A ceiling, not a page: the palette filters the whole directory in the browser.
const DIRECTORY_CAP = 2000
// Ranking runs in memory over the most recently touched matches, so a broad query stays cheap.
const TASK_CANDIDATES = 50

// The server holds the admin gate too, so hiding the button is never the only thing in the way.
async function requireSearcher() {
  const session = await getSession()
  if (!session) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const profile = await readProfile(session.user.id)
  if (!profile) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const membership = membershipOf(profile)
  if (!membership.organizationId) {
    throw new ConnectError('Finish setting up your profile first.', Code.FailedPrecondition)
  }
  if (!canManageOrganization(membership)) {
    throw new ConnectError('Search is open to admins while it is piloted.', Code.PermissionDenied)
  }

  return { organizationId: membership.organizationId }
}

export async function loadSearchDirectory(): Promise<SearchDirectory> {
  const { organizationId } = await requireSearcher()

  const [members, clients] = await Promise.all([
    db.member.findMany({
      where: {
        organizationId,
        // Same people the directory lists, minus anyone whose access was revoked.
        user: { onboardingCompletedAt: { not: null }, OR: [{ banned: false }, { banned: null }] },
      },
      orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
      take: DIRECTORY_CAP,
      select: {
        user: {
          select: {
            id: true,
            name: true,
            preferredName: true,
            jobTitle: true,
            photoKey: true,
            // Scoped to this organization so a team elsewhere can never stand in for their department.
            teammembers: {
              where: { team: { organizationId } },
              select: { team: { select: { name: true } } },
              take: 1,
            },
          },
        },
      },
    }),
    db.client.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: DIRECTORY_CAP,
      select: { id: true, name: true, status: true },
    }),
  ])

  return {
    people: members.map(({ user }) => ({
      userId: user.id,
      name: user.preferredName ?? user.name,
      jobTitle: user.jobTitle ?? '',
      department: user.teammembers[0]?.team.name ?? '',
      photoUrl: profilePhotoUrl(user.id, user.photoKey) ?? '',
    })),
    clients: clients.map((client) => ({
      clientId: client.id,
      name: client.name,
      status: client.status,
    })),
  }
}

export async function searchTasks(input: unknown): Promise<SearchTask[]> {
  const { organizationId } = await requireSearcher()

  const parsed = taskSearchSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError('Search with 2 to 100 characters.', Code.InvalidArgument)
  }
  const { query, limit } = parsed.data
  const number = taskNumberOf(query)

  const tasks = await db.task.findMany({
    where: {
      organizationId,
      isArchived: false,
      project: { isArchived: false },
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        ...(number === null ? [] : [{ taskNumber: number }]),
      ],
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    take: TASK_CANDIDATES,
    select: {
      id: true,
      taskNumber: true,
      name: true,
      projectId: true,
      project: { select: { name: true } },
      status: { select: { name: true, color: true } },
    },
  })

  return rankTasks(
    tasks.map((task) => ({
      taskId: task.id,
      taskNumber: task.taskNumber,
      name: task.name,
      projectId: task.projectId,
      projectName: task.project.name,
      statusName: task.status.name,
      statusColor: task.status.color,
    })),
    query,
    limit,
  )
}
