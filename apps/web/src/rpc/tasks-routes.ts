import type { ServiceImpl } from '@ihp/rpc'
import { TasksService } from '@ihp/rpc/tasks'
import {
  createList,
  createProject,
  createTask,
  deleteTask,
  loadLists,
  loadProjects,
  loadStatuses,
  loadTasks,
  reorderTask,
  setTaskCompleted,
  updateTask,
} from '@/features/tasks/service'
import {
  assigneeFilterFromProto,
  listToProto,
  priorityFromProto,
  projectToProto,
  statusToProto,
  taskToProto,
} from './tasks-codec'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const tasks: ServiceImpl<typeof TasksService> = {
  listProjects: async (request) => ({
    projects: (await loadProjects(request.includeArchived)).map(projectToProto),
  }),

  createProject: async (request) => ({
    project: projectToProto(
      await createProject({ name: request.name, color: request.color ?? '' }),
    ),
  }),

  listLists: async (request) => ({
    lists: (await loadLists(request.projectId)).map(listToProto),
  }),

  createList: async (request) => ({
    list: listToProto(await createList({ projectId: request.projectId, name: request.name })),
  }),

  listStatuses: async () => ({ statuses: (await loadStatuses()).map(statusToProto) }),

  listTasks: async (request) => {
    const rows = await loadTasks({
      projectId: request.projectId,
      listId: request.listId,
      assignee: assigneeFilterFromProto(request.assignee),
      search: request.search,
      includeArchived: request.includeArchived,
    })
    return { tasks: rows.map(taskToProto) }
  },

  createTask: async (request) => ({
    task: taskToProto(
      await createTask({
        projectId: request.projectId,
        listId: request.listId,
        name: request.name,
        description: request.description,
        priority: priorityFromProto(request.priority),
        dueDate: request.dueDate ?? '',
        assigneeIds: [...request.assigneeIds],
      }),
    ),
  }),

  updateTask: async (request) => ({
    task: taskToProto(
      await updateTask({
        taskId: request.taskId,
        ...(request.name === undefined ? {} : { name: request.name }),
        ...(request.description === undefined ? {} : { description: request.description }),
        ...(request.priority === undefined
          ? {}
          : { priority: priorityFromProto(request.priority) }),
        ...(request.statusId === undefined ? {} : { statusId: request.statusId }),
        ...(request.dueDate === undefined ? {} : { dueDate: request.dueDate }),
        ...(request.isArchived === undefined ? {} : { isArchived: request.isArchived }),
        ...(request.assignees === undefined ? {} : { assigneeIds: request.assignees.userIds }),
      }),
    ),
  }),

  completeTask: async (request) => ({
    task: taskToProto(await setTaskCompleted(request.taskId, request.completed)),
  }),

  reorderTask: async (request) => ({
    task: taskToProto(
      await reorderTask({
        taskId: request.taskId,
        listId: request.listId,
        beforeTaskId: request.beforeTaskId,
      }),
    ),
  }),

  deleteTask: async (request) => {
    await deleteTask(request.taskId)
    return {}
  },
}
