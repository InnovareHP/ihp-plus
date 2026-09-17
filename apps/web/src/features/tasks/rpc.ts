'use client'

import { ConnectError } from '@ihp/rpc'
import { browserClients } from '@/rpc/browser'
import {
  assigneeFilterToProto,
  listFromProto,
  priorityToProto,
  projectFromProto,
  statusFromProto,
  taskFromProto,
} from '@/rpc/tasks-codec'
import type {
  ListFormValues,
  ProjectFormValues,
  ReorderTaskValues,
  TaskFormValues,
  TaskListRow,
  TaskProjectRow,
  TaskQuery,
  TaskRow,
  TaskStatusRow,
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

export async function listLists(projectId: string): Promise<TaskListRow[]> {
  const response = await call(() => browserClients.tasks.listLists({ projectId }))
  return response.lists.map(listFromProto)
}

export async function createList(values: ListFormValues): Promise<TaskListRow> {
  const response = await call(() => browserClients.tasks.createList(values))
  if (!response.list) throw new Error('The server did not return the list.')
  return listFromProto(response.list)
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
    }),
  )
  return response.tasks.map(taskFromProto)
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
      assigneeIds: values.assigneeIds,
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
