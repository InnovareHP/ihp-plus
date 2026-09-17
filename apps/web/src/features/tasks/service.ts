import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { recordActivity } from '@/lib/activity'
import {
  DEFAULT_TASK_LIST_NAME,
  DEFAULT_TASK_STATUSES,
  listFormSchema,
  projectFormSchema,
  taskFormSchema,
  type ListFormValues,
  type ProjectFormValues,
  type ReorderTaskValues,
  type TaskFormValues,
  type TaskListRow,
  type TaskPriority,
  type TaskProjectRow,
  type TaskQuery,
  type TaskRow,
  type TaskStatusCategory,
  type TaskStatusRow,
  type UpdateTaskValues,
} from './schema'

// Sparse positions so a drop between two rows is one UPDATE; the list is renormalized only
// once the neighbours are too close to halve again.
const POSITION_STEP = 1024
const MIN_POSITION_GAP = 1e-6

async function requireMember() {
  const session = await getSession()
  if (!session) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const profile = await readProfile(session.user.id)
  if (!profile) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const membership = membershipOf(profile)
  if (!membership.organizationId) {
    throw new ConnectError('Finish setting up your profile first.', Code.FailedPrecondition)
  }

  return {
    userId: session.user.id,
    name: profile.preferredName ?? session.user.name,
    organizationId: membership.organizationId,
  }
}

type Caller = Awaited<ReturnType<typeof requireMember>>

const statusSelect = {
  id: true,
  name: true,
  color: true,
  category: true,
  sortOrder: true,
} satisfies Prisma.TaskStatusSelect

const taskSelect = {
  id: true,
  taskNumber: true,
  name: true,
  description: true,
  priority: true,
  projectId: true,
  listId: true,
  statusId: true,
  status: { select: statusSelect },
  assignees: { select: { userId: true } },
  startDate: true,
  dueDate: true,
  completedAt: true,
  isArchived: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaskSelect

type TaskRecord = Prisma.TaskGetPayload<{ select: typeof taskSelect }>
type StatusRecord = Prisma.TaskStatusGetPayload<{ select: typeof statusSelect }>

function toStatusRow(status: StatusRecord): TaskStatusRow {
  return {
    id: status.id,
    name: status.name,
    color: status.color,
    category: status.category as TaskStatusCategory,
    sortOrder: status.sortOrder,
  }
}

function toTaskRow(task: TaskRecord, names: ReadonlyMap<string, string>): TaskRow {
  return {
    id: task.id,
    taskNumber: task.taskNumber,
    name: task.name,
    description: task.description ?? '',
    priority: task.priority as TaskPriority,
    projectId: task.projectId,
    listId: task.listId,
    statusId: task.statusId,
    status: toStatusRow(task.status),
    assignees: task.assignees.map((assignee) => ({
      userId: assignee.userId,
      name: names.get(assignee.userId) ?? 'Removed teammate',
    })),
    startDate: task.startDate?.toISOString(),
    dueDate: task.dueDate?.toISOString(),
    completedAt: task.completedAt?.toISOString(),
    isArchived: task.isArchived,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

// One lookup for a whole board rather than a join per row: the same handful of people are
// assigned over and over.
async function assigneeNames(tasks: readonly TaskRecord[]) {
  const ids = [...new Set(tasks.flatMap((task) => task.assignees.map((one) => one.userId)))]
  if (ids.length === 0) return new Map<string, string>()

  const people = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, preferredName: true },
  })

  return new Map(people.map((person) => [person.id, person.preferredName ?? person.name]))
}

async function hydrate(task: TaskRecord) {
  return toTaskRow(task, await assigneeNames([task]))
}

/**
 * Statuses are organization-wide and seeded on first read, so nobody has to configure a board
 * before using one. skipDuplicates makes a concurrent first read harmless.
 */
async function ensureStatuses(organizationId: string) {
  const existing = await db.taskStatus.findMany({
    where: { organizationId },
    select: statusSelect,
    orderBy: { sortOrder: 'asc' },
  })
  if (existing.length > 0) return existing

  await db.taskStatus.createMany({
    data: DEFAULT_TASK_STATUSES.map((status, index) => ({
      organizationId,
      name: status.name,
      color: status.color,
      category: status.category,
      sortOrder: index + 1,
    })),
    skipDuplicates: true,
  })

  return db.taskStatus.findMany({
    where: { organizationId },
    select: statusSelect,
    orderBy: { sortOrder: 'asc' },
  })
}

async function statusOfCategory(organizationId: string, category: TaskStatusCategory) {
  const statuses = await ensureStatuses(organizationId)
  const match = statuses.find((status) => status.category === category)
  if (!match) {
    throw new ConnectError(`No "${category}" status is configured.`, Code.FailedPrecondition)
  }
  return match
}

async function projectOrThrow(caller: Caller, projectId: string) {
  const project = await db.taskProject.findFirst({
    where: { id: projectId, organizationId: caller.organizationId },
    select: { id: true, taskCounter: true },
  })
  if (!project) throw new ConnectError('That project no longer exists.', Code.NotFound)
  return project
}

async function taskOrThrow(caller: Caller, taskId: string) {
  const task = await db.task.findFirst({
    where: { id: taskId, organizationId: caller.organizationId },
    select: taskSelect,
  })
  if (!task) throw new ConnectError('That task no longer exists.', Code.NotFound)
  return task
}

export async function loadProjects(includeArchived: boolean): Promise<TaskProjectRow[]> {
  const caller = await requireMember()

  const projects = await db.taskProject.findMany({
    where: {
      organizationId: caller.organizationId,
      ...(includeArchived ? {} : { isArchived: false }),
    },
    select: {
      id: true,
      name: true,
      color: true,
      isArchived: true,
      _count: { select: { tasks: { where: { isArchived: false } } } },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    color: project.color ?? undefined,
    isArchived: project.isArchived,
    taskCount: project._count.tasks,
  }))
}

export async function createProject(values: ProjectFormValues): Promise<TaskProjectRow> {
  const caller = await requireMember()
  const parsed = projectFormSchema.parse(values)

  const count = await db.taskProject.count({ where: { organizationId: caller.organizationId } })

  // A project with no list can hold nothing, so its first one is created with it.
  const project = await db.taskProject.create({
    data: {
      organizationId: caller.organizationId,
      createdById: caller.userId,
      name: parsed.name,
      color: parsed.color || null,
      sortOrder: count + 1,
      lists: {
        create: {
          organizationId: caller.organizationId,
          name: DEFAULT_TASK_LIST_NAME,
          sortOrder: 1,
        },
      },
    },
    select: { id: true, name: true, color: true, isArchived: true },
  })

  return {
    id: project.id,
    name: project.name,
    color: project.color ?? undefined,
    isArchived: project.isArchived,
    taskCount: 0,
  }
}

export async function loadLists(projectId: string): Promise<TaskListRow[]> {
  const caller = await requireMember()
  await projectOrThrow(caller, projectId)

  const lists = await db.taskList.findMany({
    where: { projectId, organizationId: caller.organizationId },
    select: { id: true, projectId: true, name: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return lists
}

export async function createList(values: ListFormValues): Promise<TaskListRow> {
  const caller = await requireMember()
  const parsed = listFormSchema.parse(values)
  await projectOrThrow(caller, parsed.projectId)

  const count = await db.taskList.count({ where: { projectId: parsed.projectId } })

  return db.taskList.create({
    data: {
      projectId: parsed.projectId,
      organizationId: caller.organizationId,
      name: parsed.name,
      sortOrder: count + 1,
    },
    select: { id: true, projectId: true, name: true, sortOrder: true },
  })
}

export async function loadStatuses(): Promise<TaskStatusRow[]> {
  const caller = await requireMember()
  const statuses = await ensureStatuses(caller.organizationId)
  return statuses.map(toStatusRow)
}

export async function loadTasks(query: TaskQuery): Promise<TaskRow[]> {
  const caller = await requireMember()
  await projectOrThrow(caller, query.projectId)

  const search = query.search.trim()
  const tasks = await db.task.findMany({
    where: {
      organizationId: caller.organizationId,
      projectId: query.projectId,
      ...(query.listId ? { listId: query.listId } : {}),
      ...(query.includeArchived ? {} : { isArchived: false }),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(query.assignee === 'mine' ? { assignees: { some: { userId: caller.userId } } } : {}),
      ...(query.assignee === 'unassigned' ? { assignees: { none: {} } } : {}),
    },
    select: taskSelect,
    orderBy: { position: 'asc' },
  })

  const names = await assigneeNames(tasks)
  return tasks.map((task) => toTaskRow(task, names))
}

export async function createTask(values: TaskFormValues): Promise<TaskRow> {
  const caller = await requireMember()
  const parsed = taskFormSchema.parse(values)

  const list = await db.taskList.findFirst({
    where: {
      id: parsed.listId,
      projectId: parsed.projectId,
      organizationId: caller.organizationId,
    },
    select: { id: true },
  })
  if (!list) throw new ConnectError('That list no longer exists.', Code.NotFound)

  const status = await statusOfCategory(caller.organizationId, 'active')
  const assigneeIds = await knownTeammates(caller, parsed.assigneeIds)

  const created = await db.$transaction(async (tx) => {
    // The counter is incremented inside the transaction so two people creating at once cannot
    // land on the same #number.
    const project = await tx.taskProject.update({
      where: { id: parsed.projectId },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true },
    })

    const last = await tx.task.aggregate({
      where: { listId: parsed.listId },
      _max: { position: true },
    })

    return tx.task.create({
      data: {
        organizationId: caller.organizationId,
        projectId: parsed.projectId,
        listId: parsed.listId,
        statusId: status.id,
        taskNumber: project.taskCounter,
        name: parsed.name,
        description: parsed.description || null,
        priority: parsed.priority,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        position: (last._max.position ?? 0) + POSITION_STEP,
        createdById: caller.userId,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      },
      select: taskSelect,
    })
  })

  await recordActivity({
    organizationId: caller.organizationId,
    subjectType: 'task',
    subjectId: created.id,
    action: 'task.created',
    actorId: caller.userId,
    actorName: caller.name,
    detail: created.name,
  })

  return hydrate(created)
}

// Assigning someone who has left, or who was never in this organization, would put a name on a
// board that nobody can act on.
async function knownTeammates(caller: Caller, userIds: readonly string[]) {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return []

  const members = await db.member.findMany({
    where: { organizationId: caller.organizationId, userId: { in: ids } },
    select: { userId: true },
  })
  if (members.length !== ids.length) {
    throw new ConnectError('One of those people is no longer in the company.', Code.NotFound)
  }

  return members.map((member) => member.userId)
}

export async function updateTask(values: UpdateTaskValues): Promise<TaskRow> {
  const caller = await requireMember()
  const existing = await taskOrThrow(caller, values.taskId)

  const data: Prisma.TaskUpdateInput = {}
  if (values.name !== undefined) data.name = values.name.trim()
  if (values.description !== undefined) data.description = values.description.trim() || null
  if (values.priority !== undefined) data.priority = values.priority
  if (values.isArchived !== undefined) data.isArchived = values.isArchived
  if (values.dueDate !== undefined) data.dueDate = values.dueDate ? new Date(values.dueDate) : null

  if (values.statusId !== undefined) {
    const status = await db.taskStatus.findFirst({
      where: { id: values.statusId, organizationId: caller.organizationId },
      select: { id: true, category: true },
    })
    if (!status) throw new ConnectError('That status no longer exists.', Code.NotFound)
    data.status = { connect: { id: status.id } }
    // Moving a task into or out of a done column is what "completed" means on the board.
    data.completedAt = status.category === 'done' ? (existing.completedAt ?? new Date()) : null
  }

  const assigneeIds = values.assigneeIds
    ? await knownTeammates(caller, values.assigneeIds)
    : undefined

  const updated = await db.$transaction(async (tx) => {
    if (assigneeIds) {
      await tx.taskAssignee.deleteMany({
        where: { taskId: existing.id, userId: { notIn: assigneeIds.length ? assigneeIds : [''] } },
      })
      await tx.taskAssignee.createMany({
        data: assigneeIds.map((userId) => ({ taskId: existing.id, userId })),
        skipDuplicates: true,
      })
    }

    return tx.task.update({ where: { id: existing.id }, data, select: taskSelect })
  })

  return hydrate(updated)
}

export async function setTaskCompleted(taskId: string, completed: boolean): Promise<TaskRow> {
  const caller = await requireMember()
  const existing = await taskOrThrow(caller, taskId)
  const status = await statusOfCategory(caller.organizationId, completed ? 'done' : 'active')

  const updated = await db.task.update({
    where: { id: existing.id },
    data: { statusId: status.id, completedAt: completed ? new Date() : null },
    select: taskSelect,
  })

  await recordActivity({
    organizationId: caller.organizationId,
    subjectType: 'task',
    subjectId: updated.id,
    action: completed ? 'task.completed' : 'task.reopened',
    actorId: caller.userId,
    actorName: caller.name,
    detail: updated.name,
  })

  return hydrate(updated)
}

export async function reorderTask(values: ReorderTaskValues): Promise<TaskRow> {
  const caller = await requireMember()
  const task = await taskOrThrow(caller, values.taskId)

  const list = await db.taskList.findFirst({
    where: {
      id: values.listId,
      organizationId: caller.organizationId,
      projectId: task.projectId,
    },
    select: { id: true },
  })
  if (!list) throw new ConnectError('That list is not in this project.', Code.NotFound)

  const updated = await db.$transaction(async (tx) => {
    const siblings = await tx.task.findMany({
      where: { listId: values.listId, id: { not: task.id } },
      select: { id: true, position: true },
      orderBy: { position: 'asc' },
    })

    const index = values.beforeTaskId
      ? siblings.findIndex((sibling) => sibling.id === values.beforeTaskId)
      : siblings.length
    if (index === -1) throw new ConnectError('That row has moved — try again.', Code.Aborted)

    const upper = siblings[index]?.position
    const lower = index > 0 ? siblings[index - 1]?.position : undefined
    let position = upper === undefined ? (lower ?? 0) + POSITION_STEP : ((lower ?? 0) + upper) / 2

    // Halving eventually runs out of float; renormalizing the list restores the gaps.
    if (upper !== undefined && upper - (lower ?? 0) < MIN_POSITION_GAP) {
      const ordered = [...siblings.slice(0, index), { id: task.id }, ...siblings.slice(index)]
      for (const [slot, row] of ordered.entries()) {
        await tx.task.update({
          where: { id: row.id },
          data: { position: (slot + 1) * POSITION_STEP },
        })
      }
      position = (index + 1) * POSITION_STEP
    }

    return tx.task.update({
      where: { id: task.id },
      data: { listId: values.listId, position },
      select: taskSelect,
    })
  })

  return hydrate(updated)
}

export async function deleteTask(taskId: string): Promise<void> {
  const caller = await requireMember()
  const task = await taskOrThrow(caller, taskId)

  await db.task.delete({ where: { id: task.id } })

  await recordActivity({
    organizationId: caller.organizationId,
    subjectType: 'task',
    subjectId: task.id,
    action: 'task.deleted',
    actorId: caller.userId,
    actorName: caller.name,
    detail: task.name,
  })
}
