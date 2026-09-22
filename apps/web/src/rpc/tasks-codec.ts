import {
  TaskAssigneeFilter,
  TaskDueFilter,
  TaskPriority,
  TaskStatusCategory,
  type Task as TaskMessage,
  type TaskAttachmentFile as TaskAttachmentMessage,
  type TaskComment as TaskCommentMessage,
  type TaskList as TaskListMessage,
  type TaskMention as TaskMentionMessage,
  type TaskTimeEntry as TaskTimeEntryMessage,
  type TaskTimeSettings as TaskTimeSettingsMessage,
  type TaskProject as TaskProjectMessage,
  type TaskStatus as TaskStatusMessage,
} from '@ihp/rpc/tasks'
import type {
  TaskAssigneeFilter as AssigneeFilter,
  TaskAttachmentRow,
  TaskCommentRow,
  TaskDueFilter as DueFilter,
  TaskListRow,
  TaskMentionRow,
  TaskPriority as Priority,
  TaskTimeEntryRow,
  TaskTimeSettingsRow,
  TaskProjectRow,
  TaskRow,
  TaskStatusCategory as StatusCategory,
  TaskStatusRow,
} from '@/features/tasks/schema'

// The UI keeps its string unions and the wire keeps its enums; every crossing goes through
// these maps, so an UNSPECIFIED value from an older client falls back rather than throwing.
const PRIORITY_TO_PROTO: Record<Priority, TaskPriority> = {
  urgent: TaskPriority.URGENT,
  high: TaskPriority.HIGH,
  normal: TaskPriority.NORMAL,
  low: TaskPriority.LOW,
}

const PRIORITY_FROM_PROTO: Record<TaskPriority, Priority> = {
  [TaskPriority.UNSPECIFIED]: 'normal',
  [TaskPriority.URGENT]: 'urgent',
  [TaskPriority.HIGH]: 'high',
  [TaskPriority.NORMAL]: 'normal',
  [TaskPriority.LOW]: 'low',
}

const CATEGORY_TO_PROTO: Record<StatusCategory, TaskStatusCategory> = {
  active: TaskStatusCategory.ACTIVE,
  done: TaskStatusCategory.DONE,
  cancelled: TaskStatusCategory.CANCELLED,
}

const CATEGORY_FROM_PROTO: Record<TaskStatusCategory, StatusCategory> = {
  [TaskStatusCategory.UNSPECIFIED]: 'active',
  [TaskStatusCategory.ACTIVE]: 'active',
  [TaskStatusCategory.DONE]: 'done',
  [TaskStatusCategory.CANCELLED]: 'cancelled',
}

const ASSIGNEE_FILTER_TO_PROTO: Record<AssigneeFilter, TaskAssigneeFilter> = {
  all: TaskAssigneeFilter.ALL,
  mine: TaskAssigneeFilter.MINE,
  unassigned: TaskAssigneeFilter.UNASSIGNED,
}

const ASSIGNEE_FILTER_FROM_PROTO: Record<TaskAssigneeFilter, AssigneeFilter> = {
  [TaskAssigneeFilter.UNSPECIFIED]: 'all',
  [TaskAssigneeFilter.ALL]: 'all',
  [TaskAssigneeFilter.MINE]: 'mine',
  [TaskAssigneeFilter.UNASSIGNED]: 'unassigned',
}

export function priorityToProto(priority: Priority) {
  return PRIORITY_TO_PROTO[priority]
}

export function priorityFromProto(priority: TaskPriority) {
  return PRIORITY_FROM_PROTO[priority]
}

export function assigneeFilterToProto(filter: AssigneeFilter) {
  return ASSIGNEE_FILTER_TO_PROTO[filter]
}

export function assigneeFilterFromProto(filter: TaskAssigneeFilter) {
  return ASSIGNEE_FILTER_FROM_PROTO[filter]
}

export function projectToProto(project: TaskProjectRow): TaskProjectMessage {
  return {
    $typeName: 'ihp.tasks.v1.TaskProject',
    id: project.id,
    name: project.name,
    color: project.color,
    isArchived: project.isArchived,
    taskCount: project.taskCount,
  }
}

export function projectFromProto(project: TaskProjectMessage): TaskProjectRow {
  return {
    id: project.id,
    name: project.name,
    color: project.color,
    isArchived: project.isArchived,
    taskCount: project.taskCount,
  }
}

export function listToProto(list: TaskListRow): TaskListMessage {
  return {
    $typeName: 'ihp.tasks.v1.TaskList',
    id: list.id,
    projectId: list.projectId,
    name: list.name,
    sortOrder: list.sortOrder,
  }
}

export function listFromProto(list: TaskListMessage): TaskListRow {
  return {
    id: list.id,
    projectId: list.projectId,
    name: list.name,
    sortOrder: list.sortOrder,
  }
}

const DUE_TO_PROTO: Record<DueFilter, TaskDueFilter> = {
  any: TaskDueFilter.ANY,
  overdue: TaskDueFilter.OVERDUE,
  today: TaskDueFilter.TODAY,
  week: TaskDueFilter.WEEK,
  none: TaskDueFilter.NONE,
}

const DUE_FROM_PROTO: Record<TaskDueFilter, DueFilter> = {
  [TaskDueFilter.UNSPECIFIED]: 'any',
  [TaskDueFilter.ANY]: 'any',
  [TaskDueFilter.OVERDUE]: 'overdue',
  [TaskDueFilter.TODAY]: 'today',
  [TaskDueFilter.WEEK]: 'week',
  [TaskDueFilter.NONE]: 'none',
}

export function dueFilterToProto(due: DueFilter): TaskDueFilter {
  return DUE_TO_PROTO[due]
}

export function dueFilterFromProto(due: TaskDueFilter): DueFilter {
  return DUE_FROM_PROTO[due]
}

export function categoryToProto(category: StatusCategory): TaskStatusCategory {
  return CATEGORY_TO_PROTO[category]
}

export function categoryFromProto(category: TaskStatusCategory): StatusCategory {
  return CATEGORY_FROM_PROTO[category]
}

export function statusToProto(status: TaskStatusRow): TaskStatusMessage {
  return {
    $typeName: 'ihp.tasks.v1.TaskStatus',
    id: status.id,
    name: status.name,
    color: status.color,
    category: CATEGORY_TO_PROTO[status.category],
    sortOrder: status.sortOrder,
  }
}

export function statusFromProto(status: TaskStatusMessage): TaskStatusRow {
  return {
    id: status.id,
    name: status.name,
    color: status.color,
    category: CATEGORY_FROM_PROTO[status.category],
    sortOrder: status.sortOrder,
  }
}

export function taskToProto(task: TaskRow): TaskMessage {
  return {
    $typeName: 'ihp.tasks.v1.Task',
    id: task.id,
    taskNumber: task.taskNumber,
    name: task.name,
    description: task.description,
    priority: PRIORITY_TO_PROTO[task.priority],
    projectId: task.projectId,
    listId: task.listId,
    statusId: task.statusId,
    status: statusToProto(task.status),
    assignees: task.assignees.map((assignee) => ({
      $typeName: 'ihp.tasks.v1.TaskAssignee' as const,
      userId: assignee.userId,
      name: assignee.name,
    })),
    startDate: task.startDate,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    isArchived: task.isArchived,
    position: task.position,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    commentCount: task.commentCount,
    attachmentCount: task.attachmentCount,
    trackedSeconds: task.trackedSeconds,
    parentId: task.parentId,
    parentName: task.parentName,
    parentNumber: task.parentNumber,
    subtasks: task.subtasks.map((subtask) => ({
      $typeName: 'ihp.tasks.v1.Subtask' as const,
      id: subtask.id,
      name: subtask.name,
      isDone: subtask.isDone,
      position: subtask.position,
    })),
  }
}

export function taskFromProto(task: TaskMessage): TaskRow {
  return {
    id: task.id,
    taskNumber: task.taskNumber,
    name: task.name,
    description: task.description,
    priority: PRIORITY_FROM_PROTO[task.priority],
    projectId: task.projectId,
    listId: task.listId,
    statusId: task.statusId,
    status: task.status
      ? statusFromProto(task.status)
      : { id: task.statusId, name: 'Unknown', color: '#64748b', category: 'active', sortOrder: 0 },
    assignees: task.assignees.map((assignee) => ({
      userId: assignee.userId,
      name: assignee.name,
    })),
    startDate: task.startDate,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    isArchived: task.isArchived,
    position: task.position,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    commentCount: task.commentCount,
    attachmentCount: task.attachmentCount,
    trackedSeconds: task.trackedSeconds,
    parentId: task.parentId,
    parentName: task.parentName,
    parentNumber: task.parentNumber,
    subtasks: task.subtasks.map((subtask) => ({
      id: subtask.id,
      name: subtask.name,
      isDone: subtask.isDone,
      position: subtask.position,
    })),
  }
}

export function timeEntryToProto(entry: TaskTimeEntryRow): TaskTimeEntryMessage {
  return {
    $typeName: 'ihp.tasks.v1.TaskTimeEntry',
    id: entry.id,
    taskId: entry.taskId,
    userId: entry.userId,
    userName: entry.userName,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    seconds: entry.seconds,
    note: entry.note,
    isRunning: entry.isRunning,
  }
}

export function timeEntryFromProto(entry: TaskTimeEntryMessage): TaskTimeEntryRow {
  return {
    id: entry.id,
    taskId: entry.taskId,
    userId: entry.userId,
    userName: entry.userName,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    seconds: entry.seconds,
    note: entry.note,
    isRunning: entry.isRunning,
  }
}

export function timeSettingsToProto(settings: TaskTimeSettingsRow): TaskTimeSettingsMessage {
  return {
    $typeName: 'ihp.tasks.v1.TaskTimeSettings',
    allowManualEntry: settings.allowManualEntry,
    allowSelfEdit: settings.allowSelfEdit,
    requireNote: settings.requireNote,
    trackOnlyAssigned: settings.trackOnlyAssigned,
    autoStopHours: settings.autoStopHours,
  }
}

export function timeSettingsFromProto(
  settings: TaskTimeSettingsMessage | undefined,
): TaskTimeSettingsRow {
  return {
    allowManualEntry: settings?.allowManualEntry ?? true,
    allowSelfEdit: settings?.allowSelfEdit ?? true,
    requireNote: settings?.requireNote ?? false,
    trackOnlyAssigned: settings?.trackOnlyAssigned ?? false,
    autoStopHours: settings?.autoStopHours ?? 12,
  }
}

export function mentionToProto(mention: TaskMentionRow): TaskMentionMessage {
  return {
    $typeName: 'ihp.tasks.v1.TaskMention',
    commentId: mention.commentId,
    taskId: mention.taskId,
    taskNumber: mention.taskNumber,
    taskName: mention.taskName,
    projectId: mention.projectId,
    authorName: mention.authorName,
    excerpt: mention.excerpt,
    createdAt: mention.createdAt,
    isRead: mention.isRead,
  }
}

export function mentionFromProto(mention: TaskMentionMessage): TaskMentionRow {
  return {
    commentId: mention.commentId,
    taskId: mention.taskId,
    taskNumber: mention.taskNumber,
    taskName: mention.taskName,
    projectId: mention.projectId,
    authorName: mention.authorName,
    excerpt: mention.excerpt,
    createdAt: mention.createdAt,
    isRead: mention.isRead,
  }
}

export function attachmentToProto(file: TaskAttachmentRow): TaskAttachmentMessage {
  return {
    $typeName: 'ihp.tasks.v1.TaskAttachmentFile',
    id: file.id,
    fileName: file.fileName,
    contentType: file.contentType,
    // int64 crosses the wire as bigint; a file this app accepts is nowhere near the limit.
    fileSize: BigInt(file.fileSize),
    url: file.url,
    uploadedByName: file.uploadedByName,
    createdAt: file.createdAt,
    commentId: file.commentId,
  }
}

export function attachmentFromProto(file: TaskAttachmentMessage): TaskAttachmentRow {
  return {
    id: file.id,
    fileName: file.fileName,
    contentType: file.contentType,
    fileSize: Number(file.fileSize),
    url: file.url,
    uploadedByName: file.uploadedByName,
    createdAt: file.createdAt,
    commentId: file.commentId,
  }
}

export function commentToProto(comment: TaskCommentRow): TaskCommentMessage {
  return {
    $typeName: 'ihp.tasks.v1.TaskComment',
    id: comment.id,
    taskId: comment.taskId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    body: comment.body,
    mentions: comment.mentions.map((mention) => ({
      $typeName: 'ihp.tasks.v1.TaskAssignee' as const,
      userId: mention.userId,
      name: mention.name,
    })),
    attachments: comment.attachments.map(attachmentToProto),
    editedAt: comment.editedAt,
    createdAt: comment.createdAt,
  }
}

export function commentFromProto(comment: TaskCommentMessage): TaskCommentRow {
  return {
    id: comment.id,
    taskId: comment.taskId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    body: comment.body,
    mentions: comment.mentions.map((mention) => ({
      userId: mention.userId,
      name: mention.name,
    })),
    attachments: comment.attachments.map(attachmentFromProto),
    editedAt: comment.editedAt,
    createdAt: comment.createdAt,
  }
}
