'use server'

import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import {
  documentIdSchema,
  newTaskSchema,
  taskDoneSchema,
  taskIdSchema,
  userIdSchema,
  type ChecklistSetup,
  type ChecklistTaskRow,
  type NewHireChecklistView,
  type NewHireRow,
} from './schema'
import {
  addRequiredDocument,
  addTask,
  archiveTask,
  closeChecklist,
  listNewHires,
  loadChecklistFor,
  loadSetup,
  removeRequiredDocument,
  setTaskDone,
} from './service'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

const NO_ORGANIZATION = 'Your account is not part of an organization yet.'
const FORBIDDEN = 'Only an admin can manage the new-hire checklist.'

async function caller() {
  const { user, profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  return {
    userId: user.id,
    organizationId: membership.organizationId,
    canManage: canManageOrganization(membership),
  }
}

async function manager(): Promise<Result<{ userId: string; organizationId: string }>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }
  if (!who.canManage) return { ok: false, message: FORBIDDEN }
  return { ok: true, data: { userId: who.userId, organizationId: who.organizationId } }
}

/** The caller's own checklist; null means they are not a new hire, which is not an error. */
export async function getMyChecklist(): Promise<Result<NewHireChecklistView | null>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }
  return { ok: true, data: await loadChecklistFor(who.organizationId, who.userId) }
}

export async function markTaskDone(input: unknown): Promise<Result<null>> {
  const who = await caller()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = taskDoneSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That task could not be read.' }

  const changed = await setTaskDone(
    who.organizationId,
    who.userId,
    parsed.data.taskId,
    parsed.data.done,
  )
  if (!changed) return { ok: false, message: 'That task is no longer on your checklist.' }
  return { ok: true, data: null }
}

export async function getNewHires(): Promise<Result<NewHireRow[]>> {
  const who = await manager()
  if (!who.ok) return who
  return { ok: true, data: await listNewHires(who.data.organizationId) }
}

export async function closeNewHireChecklist(input: unknown): Promise<Result<null>> {
  const who = await manager()
  if (!who.ok) return who

  const parsed = userIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Choose a new hire to close.' }

  const closed = await closeChecklist(who.data.organizationId, parsed.data.userId, who.data.userId)
  if (!closed) return { ok: false, message: 'That checklist is already closed.' }
  return { ok: true, data: null }
}

export async function getChecklistSetup(): Promise<Result<ChecklistSetup>> {
  const who = await manager()
  if (!who.ok) return who
  return { ok: true, data: await loadSetup(who.data.organizationId) }
}

export async function requireDocument(input: unknown): Promise<Result<null>> {
  const who = await manager()
  if (!who.ok) return who

  const parsed = documentIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Choose a document to require.' }

  const added = await addRequiredDocument(who.data.organizationId, parsed.data.documentId)
  if (!added) return { ok: false, message: 'That document is no longer in the bluebook.' }
  return { ok: true, data: null }
}

export async function unrequireDocument(input: unknown): Promise<Result<null>> {
  const who = await manager()
  if (!who.ok) return who

  const parsed = documentIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Choose a document to remove.' }

  await removeRequiredDocument(who.data.organizationId, parsed.data.documentId)
  return { ok: true, data: null }
}

export async function createChecklistTask(input: unknown): Promise<Result<ChecklistTaskRow>> {
  const who = await manager()
  if (!who.ok) return who

  const parsed = newTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the task and retry.' }
  }
  return { ok: true, data: await addTask(who.data.organizationId, parsed.data) }
}

export async function removeChecklistTask(input: unknown): Promise<Result<null>> {
  const who = await manager()
  if (!who.ok) return who

  const parsed = taskIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Choose a task to remove.' }

  const removed = await archiveTask(who.data.organizationId, parsed.data.taskId)
  if (!removed) return { ok: false, message: 'That task is already off the list.' }
  return { ok: true, data: null }
}
