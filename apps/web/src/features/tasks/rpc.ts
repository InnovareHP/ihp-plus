'use client'

import { ConnectError } from '@ihp/rpc'
import { browserClients } from '@/rpc/browser'
import {
  assigneeFilterToProto,
  categoryToProto,
  dueFilterToProto,
  commentFromProto,
  listFromProto,
  mentionFromProto,
  priorityToProto,
  timeEntryFromProto,
  timeSettingsFromProto,
  timeSettingsToProto,
  projectFromProto,
  statusFromProto,
  taskFromProto,
} from '@/rpc/tasks-codec'
import type {
  CommentFormValues,
  LogTimeValues,
  RunningTimerRow,
  TaskActivityRow,
  ListFormValues,
  ProjectFormValues,
  ReorderTaskValues,
  StatusFormValues,
  TaskFormValues,
  TaskCommentRow,
  TaskConversation,
  TaskListRow,
  TaskMentionFeed,
  TaskProjectRow,
  TaskQuery,
  TaskRow,
  TaskStatusRow,
  TaskTimeEntryRow,
  TaskTimeLog,
  TaskTimeSettingsRow,
  TaskTimeSettingsView,
  UpdateProjectValues,
  UpdateStatusValues,
  UpdateTaskValues,
} from './schema'

/**
 * ConnectError stringifies as "[not_found] ...", putting a machine code in front of a sentence
 * a user reads. The code stays on the ConnectError for anything that branches on it; what
 * reaches the UI is the plain message.
 */
async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

function requiredTask(task: Parameters<typeof taskFromProto>[0] | undefined): TaskRow {
  if (!task) throw new Error('The server did not return the task.')
  return taskFromProto(task)
}

export async function listProjects(includeArchived = false): Promise<TaskProjectRow[]> {
  const response = await call(() => browserClients.tasks.listProjects({ includeArchived }))
  return response.projects.map(projectFromProto)
}

export async function createProject(values: ProjectFormValues): Promise<TaskProjectRow> {
  const response = await call(() =>
    browserClients.tasks.createProject({ name: values.name, color: values.color || undefined }),
  )
  if (!response.project) throw new Error('The server did not return the project.')
  return projectFromProto(response.project)
}

export async function updateProject(values: UpdateProjectValues): Promise<TaskProjectRow> {
  const response = await call(() => browserClients.tasks.updateProject(values))
  if (!response.project) throw new Error('The server did not return the project.')
  return projectFromProto(response.project)
}

export async function listLists(projectId: string): Promise<TaskListRow[]> {
  const response = await call(() => browserClients.tasks.listLists({ projectId }))
  return response.lists.map(listFromProto)
}

export async function createList(values: ListFormValues): Promise<TaskListRow> {
  const response = await call(() => browserClients.tasks.createList(values))
  if (!response.list) throw new Error('The server did not return the list.')
  return listFromProto(response.list)
}

export async function updateList(listId: string, name: string): Promise<TaskListRow> {
  const response = await call(() => browserClients.tasks.updateList({ listId, name }))
  if (!response.list) throw new Error('The server did not return the list.')
  return listFromProto(response.list)
}

export async function deleteList(listId: string): Promise<void> {
  await call(() => browserClients.tasks.deleteList({ listId }))
}

export async function createStatus(values: StatusFormValues): Promise<TaskStatusRow> {
  const response = await call(() =>
    browserClients.tasks.createStatus({
      name: values.name,
      color: values.color,
      category: categoryToProto(values.category),
    }),
  )
  if (!response.status) throw new Error('The server did not return the column.')
  return statusFromProto(response.status)
}

export async function updateStatus(values: UpdateStatusValues): Promise<TaskStatusRow> {
  const response = await call(() => browserClients.tasks.updateStatus(values))
  if (!response.status) throw new Error('The server did not return the column.')
  return statusFromProto(response.status)
}

export async function reorderStatus(
  statusId: string,
  beforeStatusId: string | undefined,
): Promise<TaskStatusRow[]> {
  const response = await call(() =>
    browserClients.tasks.reorderStatus({ statusId, beforeStatusId }),
  )
  return response.statuses.map(statusFromProto)
}

export async function deleteStatus(statusId: string, moveToStatusId?: string): Promise<void> {
  await call(() => browserClients.tasks.deleteStatus({ statusId, moveToStatusId }))
}

export async function listStatuses(): Promise<TaskStatusRow[]> {
  const response = await call(() => browserClients.tasks.listStatuses({}))
  return response.statuses.map(statusFromProto)
}

export async function listTasks(query: TaskQuery): Promise<TaskRow[]> {
  const response = await call(() =>
    browserClients.tasks.listTasks({
      projectId: query.projectId,
      listId: query.listId,
      assignee: assigneeFilterToProto(query.assignee),
      search: query.search,
      includeArchived: query.includeArchived,
      assigneeUserId: query.assigneeUserId || undefined,
      statusId: query.statusId || undefined,
      priorities: (query.priorities ?? []).map(priorityToProto),
      due: dueFilterToProto(query.due ?? 'any'),
    }),
  )
  return response.tasks.map(taskFromProto)
}

export async function getTask(taskId: string): Promise<TaskRow> {
  const response = await call(() => browserClients.tasks.getTask({ taskId }))
  return requiredTask(response.task)
}

export async function promoteSubtask(taskId: string): Promise<TaskRow> {
  const response = await call(() => browserClients.tasks.promoteSubtask({ taskId }))
  return requiredTask(response.task)
}

export async function createTask(values: TaskFormValues): Promise<TaskRow> {
  const response = await call(() =>
    browserClients.tasks.createTask({
      projectId: values.projectId,
      listId: values.listId,
      name: values.name,
      description: values.description,
      priority: priorityToProto(values.priority),
      dueDate: values.dueDate || undefined,
      startDate: values.startDate || undefined,
      assigneeIds: values.assigneeIds,
      parentId: values.parentId || undefined,
    }),
  )
  return requiredTask(response.task)
}

export async function updateTask(values: UpdateTaskValues): Promise<TaskRow> {
  const response = await call(() =>
    browserClients.tasks.updateTask({
      taskId: values.taskId,
      name: values.name,
      description: values.description,
      priority: values.priority === undefined ? undefined : priorityToProto(values.priority),
      statusId: values.statusId,
      dueDate: values.dueDate,
      isArchived: values.isArchived,
      assignees: values.assigneeIds
        ? { $typeName: 'ihp.tasks.v1.AssigneeIds', userIds: [...values.assigneeIds] }
        : undefined,
    }),
  )
  return requiredTask(response.task)
}

export async function completeTask(taskId: string, completed: boolean): Promise<TaskRow> {
  const response = await call(() => browserClients.tasks.completeTask({ taskId, completed }))
  return requiredTask(response.task)
}

export async function reorderTask(values: ReorderTaskValues): Promise<TaskRow> {
  const response = await call(() => browserClients.tasks.reorderTask(values))
  return requiredTask(response.task)
}

export async function deleteTask(taskId: string): Promise<void> {
  await call(() => browserClients.tasks.deleteTask({ taskId }))
}

export async function getTimeSettings(): Promise<TaskTimeSettingsView> {
  const response = await call(() => browserClients.tasks.getTimeSettings({}))
  return {
    settings: timeSettingsFromProto(response.settings),
    canManage: response.canManage,
  }
}

export async function updateTimeSettings(
  settings: TaskTimeSettingsRow,
): Promise<TaskTimeSettingsRow> {
  const response = await call(() =>
    browserClients.tasks.updateTimeSettings({ settings: timeSettingsToProto(settings) }),
  )
  return timeSettingsFromProto(response.settings)
}

export async function listTimeEntries(taskId: string): Promise<TaskTimeLog> {
  const response = await call(() => browserClients.tasks.listTimeEntries({ taskId }))
  return {
    entries: response.entries.map(timeEntryFromProto),
    totalSeconds: response.totalSeconds,
  }
}

export async function startTimer(taskId: string): Promise<TaskTimeEntryRow> {
  const response = await call(() => browserClients.tasks.startTimer({ taskId }))
  if (!response.entry) throw new Error('The server did not return the timer.')
  return timeEntryFromProto(response.entry)
}

export async function stopTimer(note?: string): Promise<TaskTimeEntryRow | undefined> {
  const response = await call(() => browserClients.tasks.stopTimer({ note }))
  return response.entry ? timeEntryFromProto(response.entry) : undefined
}

export async function getRunningTimer(): Promise<RunningTimerRow | undefined> {
  const response = await call(() => browserClients.tasks.getRunningTimer({}))
  if (!response.entry) return undefined

  return {
    entry: timeEntryFromProto(response.entry),
    taskName: response.taskName ?? '',
    taskNumber: response.taskNumber ?? 0,
    projectId: response.projectId ?? '',
  }
}

export async function logTime(values: LogTimeValues): Promise<TaskTimeEntryRow> {
  const response = await call(() =>
    browserClients.tasks.logTime({
      taskId: values.taskId,
      seconds: values.seconds,
      spentOn: values.spentOn || undefined,
      note: values.note || undefined,
    }),
  )
  if (!response.entry) throw new Error('The server did not return the entry.')
  return timeEntryFromProto(response.entry)
}

export async function deleteTimeEntry(entryId: string): Promise<void> {
  await call(() => browserClients.tasks.deleteTimeEntry({ entryId }))
}

export async function listMentions(includeRead: boolean): Promise<TaskMentionFeed> {
  const response = await call(() => browserClients.tasks.listMentions({ includeRead }))
  return {
    mentions: response.mentions.map(mentionFromProto),
    unreadCount: response.unreadCount,
  }
}

export async function markMentionRead(commentId: string, read: boolean): Promise<void> {
  await call(() => browserClients.tasks.markMentionRead({ commentId, read }))
}

export async function markAllMentionsRead(): Promise<void> {
  await call(() => browserClients.tasks.markAllMentionsRead({}))
}

export async function listTaskActivity(taskId: string): Promise<TaskActivityRow[]> {
  const response = await call(() => browserClients.tasks.listTaskActivity({ taskId }))
  return response.entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    actorName: entry.actorName,
    detail: entry.detail,
    createdAt: entry.createdAt,
  }))
}

export async function listConversation(taskId: string): Promise<TaskConversation> {
  const response = await call(() => browserClients.tasks.listComments({ taskId }))
  return { comments: response.comments.map(commentFromProto) }
}

function requiredComment(comment: Parameters<typeof commentFromProto>[0] | undefined) {
  if (!comment) throw new Error('The server did not return the comment.')
  return commentFromProto(comment)
}

export async function createComment(
  values: CommentFormValues & { taskId: string },
): Promise<TaskCommentRow> {
  const response = await call(() =>
    browserClients.tasks.createComment({
      taskId: values.taskId,
      body: values.body,
      mentionUserIds: [...values.mentionUserIds],
      attachmentIds: [...values.attachmentIds],
    }),
  )
  return requiredComment(response.comment)
}

export async function updateComment(
  commentId: string,
  body: string,
  mentionUserIds: readonly string[],
): Promise<TaskCommentRow> {
  const response = await call(() =>
    browserClients.tasks.updateComment({ commentId, body, mentionUserIds: [...mentionUserIds] }),
  )
  return requiredComment(response.comment)
}

export async function deleteComment(commentId: string): Promise<void> {
  await call(() => browserClients.tasks.deleteComment({ commentId }))
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  await call(() => browserClients.tasks.deleteAttachment({ attachmentId }))
}
