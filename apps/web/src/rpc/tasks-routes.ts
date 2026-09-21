import type { ServiceImpl } from '@ihp/rpc'
import { TasksService } from '@ihp/rpc/tasks'
import {
  createComment,
  createList,
  createProject,
  createStatus,
  createTask,
  deleteAttachment,
  deleteComment,
  deleteList,
  deleteStatus,
  deleteTask,
  deleteTimeEntry,
  getTask,
  loadConversation,
  loadLists,
  loadMentions,
  loadRunningTimer,
  loadTaskActivity,
  loadTimeLog,
  loadTimeSettings,
  loadProjects,
  loadStatuses,
  loadTasks,
  logTime,
  markAllMentionsRead,
  markMentionRead,
  promoteSubtask,
  reorderStatus,
  reorderTask,
  saveTimeSettings,
  setTaskCompleted,
  startTimer,
  stopTimer,
  updateComment,
  updateList,
  updateProject,
  updateStatus,
  updateTask,
} from '@/features/tasks/service'
import {
  assigneeFilterFromProto,
  categoryFromProto,
  dueFilterFromProto,
  commentToProto,
  listToProto,
  mentionToProto,
  priorityFromProto,
  timeEntryToProto,
  timeSettingsFromProto,
  timeSettingsToProto,
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

  updateProject: async (request) => ({
    project: projectToProto(
      await updateProject({
        projectId: request.projectId,
        ...(request.name === undefined ? {} : { name: request.name }),
        ...(request.color === undefined ? {} : { color: request.color }),
        ...(request.isArchived === undefined ? {} : { isArchived: request.isArchived }),
      }),
    ),
  }),

  listLists: async (request) => ({
    lists: (await loadLists(request.projectId)).map(listToProto),
  }),

  createList: async (request) => ({
    list: listToProto(await createList({ projectId: request.projectId, name: request.name })),
  }),

  updateList: async (request) => ({
    list: listToProto(await updateList(request.listId, request.name)),
  }),

  deleteList: async (request) => {
    await deleteList(request.listId)
    return {}
  },

  listStatuses: async () => ({ statuses: (await loadStatuses()).map(statusToProto) }),

  createStatus: async (request) => ({
    status: statusToProto(
      await createStatus({
        name: request.name,
        color: request.color,
        category: categoryFromProto(request.category),
      }),
    ),
  }),

  updateStatus: async (request) => ({
    status: statusToProto(
      await updateStatus({
        statusId: request.statusId,
        ...(request.name === undefined ? {} : { name: request.name }),
        ...(request.color === undefined ? {} : { color: request.color }),
      }),
    ),
  }),

  reorderStatus: async (request) => ({
    statuses: (await reorderStatus(request.statusId, request.beforeStatusId)).map(statusToProto),
  }),

  deleteStatus: async (request) => {
    await deleteStatus(request.statusId, request.moveToStatusId)
    return {}
  },

  listTasks: async (request) => {
    const rows = await loadTasks({
      projectId: request.projectId,
      listId: request.listId,
      assignee: assigneeFilterFromProto(request.assignee),
      search: request.search,
      includeArchived: request.includeArchived,
      assigneeUserId: request.assigneeUserId,
      statusId: request.statusId,
      priorities: request.priorities.map(priorityFromProto),
      due: dueFilterFromProto(request.due),
    })
    return { tasks: rows.map(taskToProto) }
  },

  getTask: async (request) => ({ task: taskToProto(await getTask(request.taskId)) }),

  promoteSubtask: async (request) => ({
    task: taskToProto(await promoteSubtask(request.taskId)),
  }),

  createTask: async (request) => ({
    task: taskToProto(
      await createTask({
        projectId: request.projectId,
        listId: request.listId,
        name: request.name,
        description: request.description,
        priority: priorityFromProto(request.priority),
        dueDate: request.dueDate ?? '',
        startDate: request.startDate ?? '',
        assigneeIds: [...request.assigneeIds],
        parentId: request.parentId ?? '',
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
        ...(request.startDate === undefined ? {} : { startDate: request.startDate }),
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
        ...(request.statusId === undefined ? {} : { statusId: request.statusId }),
      }),
    ),
  }),

  deleteTask: async (request) => {
    await deleteTask(request.taskId)
    return {}
  },

  getTimeSettings: async () => {
    const view = await loadTimeSettings()
    return { settings: timeSettingsToProto(view.settings), canManage: view.canManage }
  },

  updateTimeSettings: async (request) => ({
    settings: timeSettingsToProto(await saveTimeSettings(timeSettingsFromProto(request.settings))),
  }),

  listTimeEntries: async (request) => {
    const log = await loadTimeLog(request.taskId)
    return { entries: log.entries.map(timeEntryToProto), totalSeconds: log.totalSeconds }
  },

  startTimer: async (request) => ({ entry: timeEntryToProto(await startTimer(request.taskId)) }),

  stopTimer: async (request) => {
    const stopped = await stopTimer(request.note)
    return { entry: stopped ? timeEntryToProto(stopped) : undefined }
  },

  getRunningTimer: async () => {
    const running = await loadRunningTimer()
    if (!running) return {}
    return {
      entry: timeEntryToProto(running.entry),
      taskName: running.taskName,
      taskNumber: running.taskNumber,
      projectId: running.projectId,
    }
  },

  logTime: async (request) => ({
    entry: timeEntryToProto(
      await logTime({
        taskId: request.taskId,
        seconds: request.seconds,
        spentOn: request.spentOn ?? '',
        note: request.note ?? '',
      }),
    ),
  }),

  deleteTimeEntry: async (request) => {
    await deleteTimeEntry(request.entryId)
    return {}
  },

  listMentions: async (request) => {
    const feed = await loadMentions(request.includeRead)
    return { mentions: feed.mentions.map(mentionToProto), unreadCount: feed.unreadCount }
  },

  markMentionRead: async (request) => {
    await markMentionRead(request.commentId, request.read)
    return {}
  },

  markAllMentionsRead: async () => {
    await markAllMentionsRead()
    return {}
  },

  listTaskActivity: async (request) => ({
    entries: (await loadTaskActivity(request.taskId)).map((entry) => ({
      $typeName: 'ihp.tasks.v1.TaskActivityEntry' as const,
      id: entry.id,
      label: entry.label,
      actorName: entry.actorName,
      detail: entry.detail,
      createdAt: entry.createdAt,
    })),
  }),

  listComments: async (request) => {
    const conversation = await loadConversation(request.taskId)
    return { comments: conversation.comments.map(commentToProto) }
  },

  createComment: async (request) => ({
    comment: commentToProto(
      await createComment({
        taskId: request.taskId,
        body: request.body,
        mentionUserIds: [...request.mentionUserIds],
        attachmentIds: [...request.attachmentIds],
      }),
    ),
  }),

  updateComment: async (request) => ({
    comment: commentToProto(
      await updateComment(request.commentId, request.body, request.mentionUserIds),
    ),
  }),

  deleteComment: async (request) => {
    await deleteComment(request.commentId)
    return {}
  },

  deleteAttachment: async (request) => {
    await deleteAttachment(request.attachmentId)
    return {}
  },
}
