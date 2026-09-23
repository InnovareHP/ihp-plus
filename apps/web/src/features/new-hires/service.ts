import { db } from '@ihp/db'
import {
  doneCountOf,
  progressOf,
  stuckOnOf,
  type HireFacts,
  type RequiredDocument,
  type TaskDefinition,
} from './progress'
import type {
  ChecklistProgress,
  ChecklistSetup,
  NewHireChecklistView,
  NewHireRow,
  NewTaskValues,
} from './schema'

/** Idempotent: finishing setup twice must not start a second checklist. */
export async function startChecklist(organizationId: string, userId: string) {
  await db.newHireChecklist.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: { organizationId, userId },
    update: {},
  })
}

async function requiredDocumentsOf(organizationId: string): Promise<RequiredDocument[]> {
  const rows = await db.newHireDocument.findMany({
    // An archived document is off the shelf, so nobody can be asked to read it.
    where: { organizationId, document: { archivedAt: null } },
    select: {
      document: { select: { id: true, title: true, teams: { select: { teamId: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(({ document }) => ({
    id: document.id,
    title: document.title,
    teamIds: document.teams.map((team) => team.teamId),
  }))
}

async function tasksOf(organizationId: string): Promise<TaskDefinition[]> {
  return db.newHireTask.findMany({
    where: { organizationId, archivedAt: null },
    select: { id: true, title: true, description: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

interface Hire {
  userId: string
  name: string
  jobTitle: string | undefined
  teamName: string | undefined
  facts: HireFacts
}

/** Everything the steps depend on, for many hires at once, in a fixed number of queries. */
async function hiresOf(
  organizationId: string,
  userIds: readonly string[],
  documents: readonly RequiredDocument[],
  tasks: readonly TaskDefinition[],
): Promise<Map<string, Hire>> {
  if (userIds.length === 0) return new Map()
  const ids = [...userIds]

  const [users, schedules, acknowledgements, completions] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        preferredName: true,
        jobTitle: true,
        phone: true,
        photoKey: true,
        teammembers: { select: { team: { select: { id: true, name: true } } } },
      },
    }),
    db.attendanceSchedule.findMany({
      where: { organizationId, userId: { in: ids } },
      select: { userId: true, shift: { select: { name: true } } },
    }),
    documents.length === 0
      ? []
      : db.bluebookAcknowledgement.findMany({
          where: { userId: { in: ids }, documentId: { in: documents.map((doc) => doc.id) } },
          select: { userId: true, documentId: true },
        }),
    tasks.length === 0
      ? []
      : db.newHireTaskCompletion.findMany({
          where: { userId: { in: ids }, taskId: { in: tasks.map((task) => task.id) } },
          select: { userId: true, taskId: true },
        }),
  ])

  const shiftOf = new Map(schedules.map((row) => [row.userId, row.shift.name]))
  const grouped = <T extends { userId: string }>(rows: readonly T[], pick: (row: T) => string) => {
    const map = new Map<string, Set<string>>()
    for (const row of rows) {
      const set = map.get(row.userId) ?? new Set<string>()
      set.add(pick(row))
      map.set(row.userId, set)
    }
    return map
  }
  const read = grouped(acknowledgements, (row) => row.documentId)
  const ticked = grouped(completions, (row) => row.taskId)

  return new Map(
    users.map((user): [string, Hire] => [
      user.id,
      {
        userId: user.id,
        name: user.preferredName || user.name,
        jobTitle: user.jobTitle ?? undefined,
        teamName: user.teammembers[0]?.team.name,
        facts: {
          phone: user.phone,
          photoKey: user.photoKey,
          teamIds: user.teammembers.map((member) => member.team.id),
          shiftName: shiftOf.get(user.id),
          acknowledgedDocumentIds: read.get(user.id) ?? new Set(),
          completedTaskIds: ticked.get(user.id) ?? new Set(),
        },
      },
    ]),
  )
}

function isComplete(progress: ChecklistProgress) {
  return stuckOnOf(progress) === undefined
}

/** A checklist is stamped the first time it is seen complete, so later requirements never reopen it. */
async function stampCompleted(organizationId: string, userIds: readonly string[]) {
  if (userIds.length === 0) return undefined
  const now = new Date()
  await db.newHireChecklist.updateMany({
    where: { organizationId, userId: { in: [...userIds] }, completedAt: null },
    data: { completedAt: now },
  })
  return now
}

/** The signed-in hire's own checklist, or null for someone who is not a new hire. */
export async function loadChecklistFor(
  organizationId: string,
  userId: string,
): Promise<NewHireChecklistView | null> {
  const checklist = await db.newHireChecklist.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { startedAt: true, completedAt: true },
  })
  if (!checklist) return null

  const [documents, tasks] = await Promise.all([
    requiredDocumentsOf(organizationId),
    tasksOf(organizationId),
  ])
  const hire = (await hiresOf(organizationId, [userId], documents, tasks)).get(userId)
  if (!hire) return null

  const progress = progressOf(hire.facts, documents, tasks)
  let completedAt = checklist.completedAt
  if (!completedAt && isComplete(progress)) {
    completedAt = (await stampCompleted(organizationId, [userId])) ?? null
  }

  return {
    ...progress,
    startedAt: checklist.startedAt.toISOString(),
    completedAt: completedAt?.toISOString(),
  }
}

/** Every new hire in the organization, newest first, with where each one is stuck. */
export async function listNewHires(organizationId: string): Promise<NewHireRow[]> {
  const [checklists, documents, tasks] = await Promise.all([
    db.newHireChecklist.findMany({
      where: { organizationId },
      select: { userId: true, startedAt: true, completedAt: true, closedById: true },
      orderBy: { startedAt: 'desc' },
    }),
    requiredDocumentsOf(organizationId),
    tasksOf(organizationId),
  ])

  const hires = await hiresOf(
    organizationId,
    checklists.map((row) => row.userId),
    documents,
    tasks,
  )

  const rows: NewHireRow[] = []
  const finished: string[] = []
  for (const checklist of checklists) {
    // A checklist whose person has since left the database has nobody to show.
    const hire = hires.get(checklist.userId)
    if (!hire) continue

    const progress = progressOf(hire.facts, documents, tasks)
    if (!checklist.completedAt && isComplete(progress)) finished.push(checklist.userId)

    rows.push({
      userId: hire.userId,
      name: hire.name,
      jobTitle: hire.jobTitle,
      teamName: hire.teamName,
      startedAt: checklist.startedAt.toISOString(),
      completedAt: checklist.completedAt?.toISOString(),
      closedByAdmin: checklist.closedById !== null,
      progress,
      doneCount: doneCountOf(progress),
      stuckOn: stuckOnOf(progress),
    })
  }

  const stampedAt = await stampCompleted(organizationId, finished)
  return rows.map((row) =>
    stampedAt && finished.includes(row.userId)
      ? { ...row, completedAt: stampedAt.toISOString() }
      : row,
  )
}

/** False when the task is not on this organization's list, so a forged id changes nothing. */
export async function setTaskDone(
  organizationId: string,
  userId: string,
  taskId: string,
  done: boolean,
) {
  const task = await db.newHireTask.findFirst({
    where: { id: taskId, organizationId, archivedAt: null },
    select: { id: true },
  })
  if (!task) return false

  if (done) {
    await db.newHireTaskCompletion.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: { taskId, userId },
      update: {},
    })
  } else {
    await db.newHireTaskCompletion.deleteMany({ where: { taskId, userId } })
  }
  return true
}

export async function closeChecklist(organizationId: string, userId: string, adminId: string) {
  const { count } = await db.newHireChecklist.updateMany({
    where: { organizationId, userId, completedAt: null },
    data: { completedAt: new Date(), closedById: adminId },
  })
  return count > 0
}

export async function loadSetup(organizationId: string): Promise<ChecklistSetup> {
  const [required, documents, tasks] = await Promise.all([
    db.newHireDocument.findMany({
      where: { organizationId, document: { archivedAt: null } },
      select: {
        document: {
          select: { id: true, title: true, teams: { select: { teamName: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.bluebookDocument.findMany({
      where: { organizationId, archivedAt: null },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    }),
    tasksOf(organizationId),
  ])

  const requiredIds = new Set(required.map(({ document }) => document.id))
  return {
    requiredDocuments: required.map(({ document }) => ({
      documentId: document.id,
      title: document.title,
      audience:
        document.teams.length === 0
          ? 'All departments'
          : document.teams.map((team) => team.teamName).join(', '),
    })),
    availableDocuments: documents.filter((document) => !requiredIds.has(document.id)),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description ?? undefined,
    })),
  }
}

/** False when the document is not in this organization's bluebook. */
export async function addRequiredDocument(organizationId: string, documentId: string) {
  const document = await db.bluebookDocument.findFirst({
    where: { id: documentId, organizationId, archivedAt: null },
    select: { id: true },
  })
  if (!document) return false

  await db.newHireDocument.upsert({
    where: { organizationId_documentId: { organizationId, documentId } },
    create: { organizationId, documentId },
    update: {},
  })
  return true
}

export async function removeRequiredDocument(organizationId: string, documentId: string) {
  await db.newHireDocument.deleteMany({ where: { organizationId, documentId } })
}

export async function addTask(organizationId: string, values: NewTaskValues) {
  const last = await db.newHireTask.aggregate({
    where: { organizationId, archivedAt: null },
    _max: { sortOrder: true },
  })
  const task = await db.newHireTask.create({
    data: {
      organizationId,
      title: values.title,
      description: values.description || null,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
    select: { id: true, title: true, description: true },
  })
  return { id: task.id, title: task.title, description: task.description ?? undefined }
}

export async function archiveTask(organizationId: string, taskId: string) {
  const { count } = await db.newHireTask.updateMany({
    where: { id: taskId, organizationId, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  return count > 0
}
