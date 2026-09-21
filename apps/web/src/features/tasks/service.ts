import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { loadActivity, recordActivity } from '@/lib/activity'
import { deleteObject, objectUrl } from '@/lib/s3'
import { notifyComment } from './notifications'
import { mentionsEveryone } from './utils/mentions'
import {
  commentFormSchema,
  DEFAULT_TASK_LIST_NAME,
  DEFAULT_TASK_STATUSES,
  listFormSchema,
  MENTION_EVERYONE,
  projectFormSchema,
  statusFormSchema,
  taskFormSchema,
  type CommentFormValues,
  type ListFormValues,
  type ProjectFormValues,
  type ReorderTaskValues,
  type TaskFormValues,
  type TaskAttachmentRow,
  type TaskCommentRow,
  type TaskConversation,
  type TaskDueFilter,
  type TaskActivityRow,
  type TaskListRow,
  type TaskMentionFeed,
  type TaskPriority,
  type TaskProjectRow,
  type TaskQuery,
  type TaskRow,
  type TaskStatusCategory,
  type TaskStatusRow,
  type StatusFormValues,
  type UpdateProjectValues,
  type UpdateStatusValues,
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
  _count: { select: { comments: true, attachments: true } },
  parentId: true,
  subtasks: {
    select: { id: true, name: true, completedAt: true, position: true },
    orderBy: { position: 'asc' as const },
  },
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
    commentCount: task._count.comments,
    attachmentCount: task._count.attachments,
    parentId: task.parentId ?? undefined,
    subtasks: task.subtasks.map((subtask) => ({
      id: subtask.id,
      name: subtask.name,
      isDone: subtask.completedAt !== null,
      position: subtask.position,
    })),
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

async function statusOrThrow(caller: Caller, statusId: string) {
  const status = await db.taskStatus.findFirst({
    where: { id: statusId, organizationId: caller.organizationId },
    select: statusSelect,
  })
  if (!status) throw new ConnectError('That column no longer exists.', Code.NotFound)
  return status
}

async function projectOrThrow(caller: Caller, projectId: string) {
  const project = await db.taskProject.findFirst({
    where: { id: projectId, organizationId: caller.organizationId },
    select: { id: true, taskCounter: true },
  })
  if (!project) throw new ConnectError('That project no longer exists.', Code.NotFound)
  return project
}

// One level only: a checklist that can nest is an outline, and the board cannot draw one.
async function parentOrThrow(caller: Caller, parentId: string) {
  const parent = await db.task.findFirst({
    where: { id: parentId, organizationId: caller.organizationId },
    select: { id: true, projectId: true, listId: true, parentId: true },
  })
  if (!parent) throw new ConnectError('That task no longer exists.', Code.NotFound)
  if (parent.parentId) {
    throw new ConnectError('A subtask cannot have subtasks of its own.', Code.FailedPrecondition)
  }
  return parent
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

export async function updateProject(values: UpdateProjectValues): Promise<TaskProjectRow> {
  const caller = await requireMember()
  await projectOrThrow(caller, values.projectId)

  const data: Prisma.TaskProjectUpdateInput = {}
  if (values.name !== undefined) {
    const name = values.name.trim()
    if (!name) throw new ConnectError('Name the project.', Code.InvalidArgument)
    data.name = name
  }
  if (values.color !== undefined) data.color = values.color.trim() || null
  if (values.isArchived !== undefined) data.isArchived = values.isArchived

  const project = await db.taskProject.update({
    where: { id: values.projectId },
    data,
    select: {
      id: true,
      name: true,
      color: true,
      isArchived: true,
      _count: { select: { tasks: { where: { isArchived: false } } } },
    },
  })

  return {
    id: project.id,
    name: project.name,
    color: project.color ?? undefined,
    isArchived: project.isArchived,
    taskCount: project._count.tasks,
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

export async function updateList(listId: string, name: string): Promise<TaskListRow> {
  const caller = await requireMember()
  const trimmed = name.trim()
  if (!trimmed) throw new ConnectError('Name the list.', Code.InvalidArgument)

  const list = await db.taskList.findFirst({
    where: { id: listId, organizationId: caller.organizationId },
    select: { id: true },
  })
  if (!list) throw new ConnectError('That list no longer exists.', Code.NotFound)

  return db.taskList.update({
    where: { id: list.id },
    data: { name: trimmed },
    select: { id: true, projectId: true, name: true, sortOrder: true },
  })
}

export async function deleteList(listId: string): Promise<void> {
  const caller = await requireMember()

  const list = await db.taskList.findFirst({
    where: { id: listId, organizationId: caller.organizationId },
    select: { id: true, projectId: true, _count: { select: { tasks: true } } },
  })
  if (!list) throw new ConnectError('That list no longer exists.', Code.NotFound)

  if (list._count.tasks > 0) {
    throw new ConnectError(
      'That list still holds tasks \u2014 move or delete them first.',
      Code.FailedPrecondition,
    )
  }

  // A project with no list can hold nothing, so the last one stays.
  const siblings = await db.taskList.count({ where: { projectId: list.projectId } })
  if (siblings <= 1) {
    throw new ConnectError('A project keeps at least one list.', Code.FailedPrecondition)
  }

  await db.taskList.delete({ where: { id: list.id } })
}

export async function createStatus(values: StatusFormValues): Promise<TaskStatusRow> {
  const caller = await requireMember()
  const parsed = statusFormSchema.parse(values)
  const existing = await ensureStatuses(caller.organizationId)

  if (existing.some((status) => status.name.toLowerCase() === parsed.name.toLowerCase())) {
    throw new ConnectError('A column already goes by that name.', Code.AlreadyExists)
  }

  const created = await db.taskStatus.create({
    data: {
      organizationId: caller.organizationId,
      name: parsed.name,
      color: parsed.color,
      category: parsed.category,
      sortOrder: existing.length + 1,
    },
    select: statusSelect,
  })

  return toStatusRow(created)
}

export async function updateStatus(values: UpdateStatusValues): Promise<TaskStatusRow> {
  const caller = await requireMember()
  const status = await statusOrThrow(caller, values.statusId)

  const data: Prisma.TaskStatusUpdateInput = {}
  if (values.name !== undefined) {
    const name = values.name.trim()
    if (!name) throw new ConnectError('Name the column.', Code.InvalidArgument)
    data.name = name
  }
  if (values.color !== undefined) data.color = values.color.trim()

  const updated = await db.taskStatus.update({
    where: { id: status.id },
    data,
    select: statusSelect,
  })

  return toStatusRow(updated)
}

/** Columns are renumbered from one on every move, so their order never drifts apart. */
export async function reorderStatus(
  statusId: string,
  beforeStatusId: string | undefined,
): Promise<TaskStatusRow[]> {
  const caller = await requireMember()
  const status = await statusOrThrow(caller, statusId)
  const statuses = await ensureStatuses(caller.organizationId)

  const rest = statuses.filter((one) => one.id !== status.id)
  const index = beforeStatusId ? rest.findIndex((one) => one.id === beforeStatusId) : rest.length
  if (index === -1) throw new ConnectError('That column has moved \u2014 try again.', Code.Aborted)

  const ordered = [...rest.slice(0, index), status, ...rest.slice(index)]

  await db.$transaction(
    ordered.map((one, slot) =>
      db.taskStatus.update({ where: { id: one.id }, data: { sortOrder: slot + 1 } }),
    ),
  )

  const refreshed = await db.taskStatus.findMany({
    where: { organizationId: caller.organizationId },
    select: statusSelect,
    orderBy: { sortOrder: 'asc' },
  })

  return refreshed.map(toStatusRow)
}

export async function deleteStatus(statusId: string, moveToStatusId?: string): Promise<void> {
  const caller = await requireMember()
  const status = await statusOrThrow(caller, statusId)
  const statuses = await ensureStatuses(caller.organizationId)

  // Every category keeps one column: the app resolves "done" and "active" by category.
  const sameCategory = statuses.filter((one) => one.category === status.category)
  if (sameCategory.length <= 1) {
    throw new ConnectError(
      `"${status.name}" is the last ${status.category} column \u2014 rename it instead.`,
      Code.FailedPrecondition,
    )
  }

  const held = await db.task.count({ where: { statusId: status.id } })
  if (held > 0) {
    const target = moveToStatusId
      ? statuses.find((one) => one.id === moveToStatusId && one.id !== status.id)
      : undefined
    if (!target) {
      throw new ConnectError(
        'Say which column that work moves to before deleting this one.',
        Code.FailedPrecondition,
      )
    }

    await db.task.updateMany({
      where: { statusId: status.id },
      data: {
        statusId: target.id,
        ...(target.category === 'done' ? {} : { completedAt: null }),
      },
    })
  }

  await db.taskStatus.delete({ where: { id: status.id } })
}

export async function loadStatuses(): Promise<TaskStatusRow[]> {
  const caller = await requireMember()
  const statuses = await ensureStatuses(caller.organizationId)
  return statuses.map(toStatusRow)
}

/** "Overdue" is a question about open work: a finished task cannot be late any more. */
function dueWindow(due: TaskDueFilter | undefined): Prisma.TaskWhereInput {
  if (!due || due === 'any') return {}
  if (due === 'none') return { dueDate: null }

  const now = new Date()
  if (due === 'overdue') {
    return { dueDate: { lt: now }, status: { category: 'active' } }
  }

  const end = new Date(now)
  if (due === 'today') {
    end.setHours(23, 59, 59, 999)
  } else {
    end.setDate(end.getDate() + 7)
  }

  return { dueDate: { not: null, lte: end } }
}

export async function loadTasks(query: TaskQuery): Promise<TaskRow[]> {
  const caller = await requireMember()
  await projectOrThrow(caller, query.projectId)

  const search = query.search.trim()
  const tasks = await db.task.findMany({
    where: {
      organizationId: caller.organizationId,
      projectId: query.projectId,
      // Subtasks belong to their parent's panel, not to a column of their own.
      parentId: null,
      ...(query.listId ? { listId: query.listId } : {}),
      ...(query.includeArchived ? {} : { isArchived: false }),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(query.assignee === 'mine' ? { assignees: { some: { userId: caller.userId } } } : {}),
      ...(query.assignee === 'unassigned' ? { assignees: { none: {} } } : {}),
      ...(query.assigneeUserId ? { assignees: { some: { userId: query.assigneeUserId } } } : {}),
      ...(query.statusId ? { statusId: query.statusId } : {}),
      ...(query.priorities && query.priorities.length > 0
        ? { priority: { in: [...query.priorities] } }
        : {}),
      ...dueWindow(query.due),
    },
    select: taskSelect,
    orderBy: { position: 'asc' },
  })

  const names = await assigneeNames(tasks)
  return tasks.map((task) => toTaskRow(task, names))
}

export async function getTask(taskId: string): Promise<TaskRow> {
  const caller = await requireMember()
  return hydrate(await taskOrThrow(caller, taskId))
}

/** Position is per list, so a promoted subtask lands at the end of the list it was already in. */
export async function promoteSubtask(taskId: string): Promise<TaskRow> {
  const caller = await requireMember()
  const task = await taskOrThrow(caller, taskId)

  if (!task.parentId) {
    throw new ConnectError('That task is not a subtask.', Code.FailedPrecondition)
  }

  const last = await db.task.aggregate({
    where: { listId: task.listId, parentId: null },
    _max: { position: true },
  })

  const promoted = await db.task.update({
    where: { id: task.id },
    data: { parentId: null, position: (last._max.position ?? 0) + POSITION_STEP },
    select: taskSelect,
  })

  return hydrate(promoted)
}

export async function createTask(values: TaskFormValues): Promise<TaskRow> {
  const caller = await requireMember()
  const parsed = taskFormSchema.parse(values)

  // A subtask takes its project and list from its parent, so a client cannot file one
  // somewhere its parent is not.
  const parent = parsed.parentId ? await parentOrThrow(caller, parsed.parentId) : null
  const projectId = parent?.projectId ?? parsed.projectId
  const listId = parent?.listId ?? parsed.listId

  if (!parent) {
    const list = await db.taskList.findFirst({
      where: { id: listId, projectId, organizationId: caller.organizationId },
      select: { id: true },
    })
    if (!list) throw new ConnectError('That list no longer exists.', Code.NotFound)
  }

  const status = await statusOfCategory(caller.organizationId, 'active')
  const assigneeIds = await knownTeammates(caller, parsed.assigneeIds)

  const created = await db.$transaction(async (tx) => {
    // The counter is incremented inside the transaction so two people creating at once cannot
    // land on the same #number.
    const project = await tx.taskProject.update({
      where: { id: projectId },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true },
    })

    const last = await tx.task.aggregate({
      where: parent ? { parentId: parent.id } : { listId, parentId: null },
      _max: { position: true },
    })

    return tx.task.create({
      data: {
        organizationId: caller.organizationId,
        projectId,
        listId,
        statusId: status.id,
        taskNumber: project.taskCounter,
        name: parsed.name,
        description: parsed.description || null,
        priority: parsed.priority,
        startDate: parsed.startDate ? new Date(parsed.startDate) : null,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        position: (last._max.position ?? 0) + POSITION_STEP,
        createdById: caller.userId,
        parentId: parent?.id ?? null,
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
  if (values.startDate !== undefined) {
    data.startDate = values.startDate ? new Date(values.startDate) : null
  }

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

  // A drop changes the column as well as the place in it, so both land in one write.
  const status = values.statusId
    ? await db.taskStatus.findFirst({
        where: { id: values.statusId, organizationId: caller.organizationId },
        select: { id: true, category: true },
      })
    : null
  if (values.statusId && !status) {
    throw new ConnectError('That status no longer exists.', Code.NotFound)
  }

  const updated = await db.$transaction(async (tx) => {
    const siblings = await tx.task.findMany({
      // A subtask is ordered inside its parent; everything else is ordered inside its list.
      where: task.parentId
        ? { parentId: task.parentId, id: { not: task.id } }
        : { listId: values.listId, parentId: null, id: { not: task.id } },
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
      data: {
        listId: values.listId,
        position,
        ...(status
          ? {
              statusId: status.id,
              completedAt: status.category === 'done' ? (task.completedAt ?? new Date()) : null,
            }
          : {}),
      },
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

const attachmentSelect = {
  id: true,
  fileKey: true,
  fileName: true,
  contentType: true,
  fileSize: true,
  uploadedById: true,
  commentId: true,
  createdAt: true,
} satisfies Prisma.TaskAttachmentSelect

const commentSelect = {
  id: true,
  taskId: true,
  authorId: true,
  body: true,
  editedAt: true,
  createdAt: true,
  mentions: { select: { userId: true } },
  attachments: { select: attachmentSelect },
} satisfies Prisma.TaskCommentSelect

type AttachmentRecord = Prisma.TaskAttachmentGetPayload<{ select: typeof attachmentSelect }>
type CommentRecord = Prisma.TaskCommentGetPayload<{ select: typeof commentSelect }>

// One lookup for a whole conversation: the same few people author and are mentioned throughout.
async function peopleNames(ids: readonly string[]) {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return new Map<string, string>()

  const people = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, preferredName: true },
  })

  return new Map(people.map((person) => [person.id, person.preferredName ?? person.name]))
}

// Storage being unconfigured must not blank the panel: the row still lists the file, it just
// cannot be opened.
async function signedUrl(fileKey: string) {
  try {
    return await objectUrl(fileKey)
  } catch {
    return ''
  }
}

async function toAttachmentRows(
  records: readonly AttachmentRecord[],
  names: ReadonlyMap<string, string>,
): Promise<TaskAttachmentRow[]> {
  return Promise.all(
    records.map(async (record) => ({
      id: record.id,
      fileName: record.fileName,
      contentType: record.contentType,
      fileSize: record.fileSize,
      url: await signedUrl(record.fileKey),
      uploadedByName: names.get(record.uploadedById ?? '') ?? 'Removed teammate',
      createdAt: record.createdAt.toISOString(),
      commentId: record.commentId ?? undefined,
    })),
  )
}

function toCommentRow(
  comment: CommentRecord,
  names: ReadonlyMap<string, string>,
  attachments: readonly TaskAttachmentRow[],
): TaskCommentRow {
  return {
    id: comment.id,
    taskId: comment.taskId,
    authorId: comment.authorId,
    authorName: names.get(comment.authorId) ?? 'Removed teammate',
    body: comment.body,
    mentions: comment.mentions.map((mention) => ({
      userId: mention.userId,
      name: names.get(mention.userId) ?? 'Removed teammate',
    })),
    attachments: attachments.filter((file) => file.commentId === comment.id),
    editedAt: comment.editedAt?.toISOString(),
    createdAt: comment.createdAt.toISOString(),
  }
}

async function commentOrThrow(caller: Caller, commentId: string) {
  const comment = await db.taskComment.findFirst({
    where: { id: commentId, organizationId: caller.organizationId },
    select: commentSelect,
  })
  if (!comment) throw new ConnectError('That comment is no longer there.', Code.NotFound)
  return comment
}

// Moderating someone else's words is a separate feature with its own audit trail; until then
// an author owns their own comment and nothing more.
function requireAuthor(caller: Caller, authorId: string) {
  if (caller.userId !== authorId) {
    throw new ConnectError('You can only change your own comments.', Code.PermissionDenied)
  }
}

// The ids the composer sent are checked against the organization rather than trusted: a mention
// emails someone, so an id from anywhere else must never reach the mail queue. "@everyone" is
// expanded here rather than on the client, which only knows the people it happens to have loaded.
async function colleagueIds(caller: Caller, userIds: readonly string[], body: string) {
  const everyone = mentionsEveryone(body, userIds)
  const wanted = [...new Set(userIds)].filter(
    (id) => id !== caller.userId && id !== MENTION_EVERYONE,
  )
  if (!everyone && wanted.length === 0) return []

  const members = await db.member.findMany({
    where: {
      organizationId: caller.organizationId,
      ...(everyone ? {} : { userId: { in: wanted } }),
    },
    select: { userId: true },
  })

  return members.map((member) => member.userId).filter((userId) => userId !== caller.userId)
}

async function readComment(commentId: string): Promise<TaskCommentRow> {
  const comment = await db.taskComment.findUnique({
    where: { id: commentId },
    select: commentSelect,
  })
  if (!comment) throw new ConnectError('That comment is no longer there.', Code.NotFound)

  const names = await peopleNames([
    comment.authorId,
    ...comment.mentions.map((mention) => mention.userId),
    ...comment.attachments.map((file) => file.uploadedById ?? ''),
  ])

  return toCommentRow(comment, names, await toAttachmentRows(comment.attachments, names))
}

// The bell shows the last few; older mentions are found in the task itself.
const MENTION_PAGE = 20
const MENTION_EXCERPT = 140

export async function loadMentions(includeRead: boolean): Promise<TaskMentionFeed> {
  const caller = await requireMember()

  const [rows, unreadCount] = await Promise.all([
    db.taskCommentMention.findMany({
      where: {
        userId: caller.userId,
        ...(includeRead ? {} : { readAt: null }),
        comment: { organizationId: caller.organizationId },
      },
      select: {
        readAt: true,
        comment: {
          select: {
            id: true,
            body: true,
            authorId: true,
            createdAt: true,
            task: { select: { id: true, taskNumber: true, name: true, projectId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: MENTION_PAGE,
    }),
    db.taskCommentMention.count({
      where: {
        userId: caller.userId,
        readAt: null,
        comment: { organizationId: caller.organizationId },
      },
    }),
  ])

  const names = await peopleNames(rows.map((row) => row.comment.authorId))

  return {
    unreadCount,
    mentions: rows.map((row) => ({
      commentId: row.comment.id,
      taskId: row.comment.task.id,
      taskNumber: row.comment.task.taskNumber,
      taskName: row.comment.task.name,
      projectId: row.comment.task.projectId,
      authorName: names.get(row.comment.authorId) ?? 'Removed teammate',
      excerpt: excerptOf(row.comment.body),
      createdAt: row.comment.createdAt.toISOString(),
      isRead: row.readAt !== null,
    })),
  }
}

function excerptOf(body: string) {
  const flattened = body.replace(/\s+/g, ' ').trim()
  return flattened.length > MENTION_EXCERPT
    ? `${flattened.slice(0, MENTION_EXCERPT - 1)}\u2026`
    : flattened
}

export async function markMentionRead(commentId: string, read: boolean): Promise<void> {
  const caller = await requireMember()

  // Scoped to the caller's own row: a mention is read by the person it named, nobody else.
  await db.taskCommentMention.updateMany({
    where: {
      commentId,
      userId: caller.userId,
      comment: { organizationId: caller.organizationId },
    },
    data: { readAt: read ? new Date() : null },
  })
}

export async function markAllMentionsRead(): Promise<void> {
  const caller = await requireMember()

  await db.taskCommentMention.updateMany({
    where: {
      userId: caller.userId,
      readAt: null,
      comment: { organizationId: caller.organizationId },
    },
    data: { readAt: new Date() },
  })
}

/** History is per task and already recorded; this only checks the caller may see that task. */
export async function loadTaskActivity(taskId: string): Promise<TaskActivityRow[]> {
  const caller = await requireMember()
  await taskOrThrow(caller, taskId)

  return loadActivity(caller.organizationId, 'task', taskId)
}

export async function loadConversation(taskId: string): Promise<TaskConversation> {
  const caller = await requireMember()
  await taskOrThrow(caller, taskId)

  const [comments, attachments] = await Promise.all([
    db.taskComment.findMany({
      where: { taskId },
      select: commentSelect,
      orderBy: { createdAt: 'asc' },
    }),
    // Only a claimed file: one whose comment never posted is a failed upload, not content.
    db.taskAttachment.findMany({
      where: { taskId, commentId: { not: null } },
      select: attachmentSelect,
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const names = await peopleNames([
    ...comments.map((comment) => comment.authorId),
    ...comments.flatMap((comment) => comment.mentions.map((mention) => mention.userId)),
    ...attachments.map((file) => file.uploadedById ?? ''),
  ])

  const files = await toAttachmentRows(attachments, names)

  return { comments: comments.map((comment) => toCommentRow(comment, names, files)) }
}

export async function createComment(
  values: CommentFormValues & { taskId: string },
): Promise<TaskCommentRow> {
  const caller = await requireMember()
  const parsed = commentFormSchema.safeParse(values)
  if (!parsed.success) {
    throw new ConnectError(
      parsed.error.issues[0]?.message ?? 'That comment could not be posted.',
      Code.InvalidArgument,
    )
  }

  const task = await taskOrThrow(caller, values.taskId)
  const mentionedIds = await colleagueIds(caller, parsed.data.mentionUserIds, parsed.data.body)

  const comment = await db.taskComment.create({
    data: {
      organizationId: caller.organizationId,
      taskId: task.id,
      authorId: caller.userId,
      body: parsed.data.body,
      mentions: { create: mentionedIds.map((userId) => ({ userId })) },
    },
    select: { id: true },
  })

  // The files were uploaded before the comment existed, so they are claimed now; scoping the
  // update to this task, this uploader and an unclaimed file makes a stray id a no-op.
  if (parsed.data.attachmentIds.length > 0) {
    await db.taskAttachment.updateMany({
      where: {
        id: { in: parsed.data.attachmentIds },
        taskId: task.id,
        commentId: null,
        uploadedById: caller.userId,
      },
      data: { commentId: comment.id },
    })
  }

  await recordActivity({
    organizationId: caller.organizationId,
    subjectType: 'task',
    subjectId: task.id,
    action: 'task.commented',
    actorId: caller.userId,
    actorName: caller.name,
    detail: task.name,
  })

  await notifyComment({
    taskId: task.id,
    taskNumber: task.taskNumber,
    taskName: task.name,
    projectId: task.projectId,
    authorId: caller.userId,
    authorName: caller.name,
    body: parsed.data.body,
    mentionedIds,
  })

  return readComment(comment.id)
}

export async function updateComment(
  commentId: string,
  body: string,
  mentionUserIds: readonly string[],
): Promise<TaskCommentRow> {
  const caller = await requireMember()
  const existing = await commentOrThrow(caller, commentId)
  requireAuthor(caller, existing.authorId)

  const parsed = commentFormSchema.safeParse({
    body,
    mentionUserIds: [...mentionUserIds],
    attachmentIds: [],
  })
  if (!parsed.success) {
    throw new ConnectError(
      parsed.error.issues[0]?.message ?? 'That comment could not be saved.',
      Code.InvalidArgument,
    )
  }

  const mentionedIds = await colleagueIds(caller, parsed.data.mentionUserIds, parsed.data.body)
  const added = mentionedIds.filter(
    (userId) => !existing.mentions.some((mention) => mention.userId === userId),
  )

  await db.$transaction([
    db.taskCommentMention.deleteMany({
      where: { commentId: existing.id, userId: { notIn: [...mentionedIds, ''] } },
    }),
    db.taskCommentMention.createMany({
      data: mentionedIds.map((userId) => ({ commentId: existing.id, userId })),
      skipDuplicates: true,
    }),
    db.taskComment.update({
      where: { id: existing.id },
      data: { body: parsed.data.body, editedAt: new Date() },
    }),
  ])

  // Only the newly named hear about it: fixing a typo must not mail the thread a second time.
  if (added.length > 0) {
    const task = await taskOrThrow(caller, existing.taskId)
    await notifyComment({
      taskId: task.id,
      taskNumber: task.taskNumber,
      taskName: task.name,
      projectId: task.projectId,
      authorId: caller.userId,
      authorName: caller.name,
      body: parsed.data.body,
      mentionedIds: added,
    })
  }

  return readComment(existing.id)
}

export async function deleteComment(commentId: string): Promise<void> {
  const caller = await requireMember()
  const comment = await commentOrThrow(caller, commentId)
  requireAuthor(caller, comment.authorId)

  // The rows cascade with the comment, but the objects behind them do not.
  for (const file of comment.attachments) await forgetObject(file.fileKey)

  await db.taskComment.delete({ where: { id: comment.id } })
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const caller = await requireMember()
  const attachment = await db.taskAttachment.findFirst({
    where: { id: attachmentId, organizationId: caller.organizationId },
    select: { id: true, fileKey: true, uploadedById: true },
  })
  if (!attachment) throw new ConnectError('That file is no longer there.', Code.NotFound)
  if (attachment.uploadedById && attachment.uploadedById !== caller.userId) {
    throw new ConnectError('You can only remove files you attached.', Code.PermissionDenied)
  }

  await forgetObject(attachment.fileKey)
  await db.taskAttachment.delete({ where: { id: attachment.id } })
}

// Storage refusing the delete must not strand the row: without it the file is unreachable
// anyway, and the row is what the app reads.
async function forgetObject(fileKey: string) {
  try {
    await deleteObject(fileKey)
  } catch {
    // Left for whoever reconciles the bucket.
  }
}
