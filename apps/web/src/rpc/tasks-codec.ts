import {
  TaskAssigneeFilter,
  TaskPriority,
  TaskStatusCategory,
  type Task as TaskMessage,
  type TaskAttachmentFile as TaskAttachmentMessage,
  type TaskComment as TaskCommentMessage,
  type TaskList as TaskListMessage,
  type TaskProject as TaskProjectMessage,
  type TaskStatus as TaskStatusMessage,
} from '@ihp/rpc/tasks'
import type {
  TaskAssigneeFilter as AssigneeFilter,
  TaskAttachmentRow,
  TaskCommentRow,
  TaskListRow,
  TaskPriority as Priority,
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
