import { z } from 'zod'
import { ALLOWED_UPLOAD_TYPES } from '@/features/bluebook/schema'

export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const
export const TASK_STATUS_CATEGORIES = ['active', 'done', 'cancelled'] as const
export const TASK_ASSIGNEE_FILTERS = ['all', 'mine', 'unassigned'] as const
export const TASK_DUE_FILTERS = ['any', 'overdue', 'today', 'week', 'none'] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]
export type TaskStatusCategory = (typeof TASK_STATUS_CATEGORIES)[number]
export type TaskAssigneeFilter = (typeof TASK_ASSIGNEE_FILTERS)[number]
export type TaskDueFilter = (typeof TASK_DUE_FILTERS)[number]

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

// Mantine palette names, not hexes: the badge takes a theme colour.
export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: 'red',
  high: 'orange',
  normal: 'brand',
  low: 'gray',
}

export const TASK_ASSIGNEE_FILTER_LABELS: Record<TaskAssigneeFilter, string> = {
  all: 'Everyone',
  mine: 'Mine',
  unassigned: 'Unassigned',
}

export const TASK_DUE_FILTER_LABELS: Record<TaskDueFilter, string> = {
  any: 'Any time',
  overdue: 'Overdue',
  today: 'Due today',
  week: 'Due this week',
  none: 'No due date',
}

// Seeded the first time an organization opens the board, so a new company starts with columns
// instead of an empty configuration screen.
export const DEFAULT_TASK_STATUSES: readonly {
  name: string
  color: string
  category: TaskStatusCategory
}[] = [
  { name: 'Backlog', color: '#64748b', category: 'active' },
  { name: 'To do', color: '#95E5DC', category: 'active' },
  { name: 'In progress', color: '#1346C5', category: 'active' },
  { name: 'In review', color: '#0B286B', category: 'active' },
  { name: 'Done', color: '#15803d', category: 'done' },
  { name: 'Cancelled', color: '#b91c1c', category: 'cancelled' },
]

export const DEFAULT_TASK_LIST_NAME = 'Tasks'

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Name the project.').max(80, 'Keep the name under 80 characters.'),
  color: z.string().trim().default(''),
})

export const listFormSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, 'Name the list.').max(80, 'Keep the name under 80 characters.'),
})

export const statusFormSchema = z.object({
  name: z.string().trim().min(1, 'Name the column.').max(40, 'Keep the name under 40 characters.'),
  // Hex, because a status colour is organization data rather than a theme token.
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour.')
    .default('#64748b'),
  category: z.enum(TASK_STATUS_CATEGORIES).default('active'),
})

export const taskFormSchema = z
  .object({
    projectId: z.string().min(1),
    listId: z.string().min(1, 'Pick a list.'),
    name: z.string().trim().min(1, 'Say what has to be done.').max(200, 'Keep the title shorter.'),
    description: z
      .string()
      .trim()
      .max(2000, 'Keep the description under 2000 characters.')
      .default(''),
    priority: z.enum(TASK_PRIORITIES).default('normal'),
    // Empty means the task has no date at either end.
    startDate: z.string().trim().default(''),
    dueDate: z.string().trim().default(''),
    assigneeIds: z.array(z.string().min(1)).default([]),
    // Set makes this a subtask: it takes its project and list from the parent.
    parentId: z.string().trim().default(''),
  })
  .refine((values) => !values.startDate || !values.dueDate || values.startDate <= values.dueDate, {
    message: 'The due date cannot be before the start.',
    path: ['dueDate'],
  })

export const subtaskFormSchema = z.object({
  name: z.string().trim().min(1, 'Say what has to be done.').max(200, 'Keep the title shorter.'),
})

// The board's own state — which project, which list, whose work, what was typed — lives in the
// URL so a board someone is looking at can be linked to.
export const TASK_VIEWS = ['board', 'list'] as const
// The panels of the task dialog. Which one is open is a link somebody can send.
export const TASK_TABS = ['task', 'comments', 'history'] as const

export type TaskView = (typeof TASK_VIEWS)[number]
export type TaskTab = (typeof TASK_TABS)[number]

export const TASK_VIEW_LABELS: Record<TaskView, string> = {
  board: 'Board',
  list: 'List',
}

export const boardQuerySchema = z.object({
  project: z.string().trim().max(64).catch('').default(''),
  view: z.enum(TASK_VIEWS).catch('board').default('board'),
  // The open task: a detail panel has to be linkable, so it is a query param, not local state.
  task: z.string().trim().max(64).catch('').default(''),
  tab: z.enum(TASK_TABS).catch('task').default('task'),
  list: z.string().trim().max(64).catch('').default(''),
  assignee: z.enum(TASK_ASSIGNEE_FILTERS).catch('all').default('all'),
  person: z.string().trim().max(64).catch('').default(''),
  status: z.string().trim().max(64).catch('').default(''),
  priority: z.array(z.enum(TASK_PRIORITIES)).catch([]).default([]),
  due: z.enum(TASK_DUE_FILTERS).catch('any').default('any'),
  search: z.string().trim().max(100).catch('').default(''),
  archived: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((value) => value === true || value === 'true')
    .catch(false),
})

export type BoardQuery = z.infer<typeof boardQuerySchema>

export const DEFAULT_BOARD_QUERY: BoardQuery = boardQuerySchema.parse({})

export type ProjectFormValues = z.infer<typeof projectFormSchema>
export type ProjectFormInput = z.input<typeof projectFormSchema>
export type ListFormValues = z.infer<typeof listFormSchema>
export type StatusFormValues = z.infer<typeof statusFormSchema>
export type StatusFormInput = z.input<typeof statusFormSchema>
export type TaskFormValues = z.infer<typeof taskFormSchema>
export type TaskFormInput = z.input<typeof taskFormSchema>
export type SubtaskFormValues = z.infer<typeof subtaskFormSchema>

export interface TaskProjectRow {
  id: string
  name: string
  color: string | undefined
  isArchived: boolean
  taskCount: number
}

export interface TaskListRow {
  id: string
  projectId: string
  name: string
  sortOrder: number
}

export interface TaskStatusRow {
  id: string
  name: string
  color: string
  category: TaskStatusCategory
  sortOrder: number
}

export interface TaskAssigneeRef {
  userId: string
  name: string
}

/** A checklist line under a task: the whole subtask is one query away if it is ever needed. */
export interface TaskSubtaskRow {
  id: string
  name: string
  isDone: boolean
  position: number
}

export interface TaskRow {
  id: string
  taskNumber: number
  name: string
  description: string
  priority: TaskPriority
  projectId: string
  listId: string
  statusId: string
  status: TaskStatusRow
  assignees: TaskAssigneeRef[]
  startDate: string | undefined
  dueDate: string | undefined
  completedAt: string | undefined
  isArchived: boolean
  position: number
  createdAt: string
  updatedAt: string
  commentCount: number
  attachmentCount: number
  trackedSeconds: number
  parentId: string | undefined
  subtasks: TaskSubtaskRow[]
}

export interface TaskQuery {
  projectId: string
  listId: string | undefined
  assignee: TaskAssigneeFilter
  search: string
  includeArchived: boolean
  assigneeUserId?: string | undefined
  statusId?: string | undefined
  priorities?: readonly TaskPriority[]
  due?: TaskDueFilter
}

export interface UpdateTaskValues {
  taskId: string
  startDate?: string
  name?: string
  description?: string
  priority?: TaskPriority
  statusId?: string
  dueDate?: string
  isArchived?: boolean
  assigneeIds?: readonly string[]
}

export interface UpdateProjectValues {
  projectId: string
  name?: string
  color?: string
  isArchived?: boolean
}

export interface UpdateStatusValues {
  statusId: string
  name?: string
  color?: string
}

export interface ReorderTaskValues {
  taskId: string
  listId: string
  beforeTaskId: string | undefined
  /** Set by a board drop: the column it landed in. */
  statusId?: string
}

/** Work dated to begin later: it is on the board, but nobody is expected on it yet. */
export function isTaskUpcoming(task: TaskRow, now = new Date()) {
  return Boolean(task.startDate) && new Date(task.startDate as string) > now
}

/** A task counts as done when its status says so, whatever the organization named that status. */
export function isTaskDone(task: TaskRow) {
  return task.status.category === 'done'
}

export function isTaskOverdue(task: TaskRow, now: Date = new Date()) {
  if (!task.dueDate || isTaskDone(task)) return false
  return new Date(task.dueDate).getTime() < now.getTime()
}

// 25 MB is what nginx accepts on this origin (client_max_body_size), so a bigger file is
// rejected here rather than by a proxy error nobody can read.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

/** The same check client- and server-side, so the message a user reads is the rule enforced. */
export function attachmentProblem(file: { name: string; size: number; type: string }) {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_ATTACHMENT_BYTES) return 'Files have to be 25 MB or smaller.'
  if (!ALLOWED_UPLOAD_TYPES[file.type]) {
    return 'Attach a PDF, Office document, text file or image.'
  }
  return undefined
}

export const commentFormSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something before posting.')
    .max(4000, 'A comment can run to 4000 characters.'),
  mentionUserIds: z.array(z.string().min(1)).default([]),
  attachmentIds: z.array(z.string().min(1)).default([]),
})

export type CommentFormValues = z.infer<typeof commentFormSchema>

/** Editing changes the words and who hears about them; the files are their own controls. */
export const commentEditSchema = commentFormSchema.omit({ attachmentIds: true })

export type CommentEditValues = z.infer<typeof commentEditSchema>

export interface TaskAttachmentRow {
  id: string
  fileName: string
  contentType: string
  fileSize: number
  /** Presigned and short-lived, so it is never stored or cached anywhere. */
  url: string
  uploadedByName: string
  createdAt: string
  commentId: string | undefined
}

export interface TaskCommentRow {
  id: string
  taskId: string
  authorId: string
  authorName: string
  body: string
  mentions: TaskAssigneeRef[]
  attachments: TaskAttachmentRow[]
  editedAt: string | undefined
  createdAt: string
  /** Set only on the optimistic row, so the thread can say it has not landed yet. */
  isSending?: boolean
}

/** One row of the header's bell: a comment that named the viewer, and whether they read it. */
export interface TaskMentionRow {
  commentId: string
  taskId: string
  taskNumber: number
  taskName: string
  projectId: string
  authorName: string
  excerpt: string
  createdAt: string
  isRead: boolean
}

export interface TaskMentionFeed {
  mentions: TaskMentionRow[]
  /** Counted over everything, not the page shown, so the badge never understates. */
  unreadCount: number
}

export interface TaskTimeEntryRow {
  id: string
  taskId: string
  userId: string
  userName: string
  startedAt: string
  endedAt: string | undefined
  seconds: number
  note: string | undefined
  isRunning: boolean
}

export interface TaskTimeLog {
  entries: TaskTimeEntryRow[]
  totalSeconds: number
}

/** The organization's clock rules. Members read them; admins set them. */
export interface TaskTimeSettingsRow {
  allowManualEntry: boolean
  allowSelfEdit: boolean
  requireNote: boolean
  trackOnlyAssigned: boolean
  /** Hours after which a forgotten timer is closed at that length; 0 never closes one. */
  autoStopHours: number
}

export interface TaskTimeSettingsView {
  settings: TaskTimeSettingsRow
  canManage: boolean
}

export interface RunningTimerRow {
  entry: TaskTimeEntryRow
  taskName: string
  taskNumber: number
  projectId: string
}

export const timeSettingsSchema = z.object({
  allowManualEntry: z.boolean(),
  allowSelfEdit: z.boolean(),
  requireNote: z.boolean(),
  trackOnlyAssigned: z.boolean(),
  autoStopHours: z
    .number()
    .int()
    .min(0, 'Use 0 to never stop a timer on its own.')
    .max(24, 'A day is the longest a timer may run.'),
})

export const logTimeSchema = z.object({
  taskId: z.string().min(1),
  seconds: z
    .number()
    .int()
    .min(60, 'Log at least a minute.')
    .max(24 * 3600, 'A single entry cannot run past a day.'),
  spentOn: z.string().trim().default(''),
  note: z.string().trim().max(200, 'Keep the note under 200 characters.').default(''),
})

export type LogTimeValues = z.infer<typeof logTimeSchema>

export interface TaskActivityRow {
  id: string
  label: string
  actorName: string
  detail: string | undefined
  createdAt: string
}

export interface TaskConversation {
  comments: TaskCommentRow[]
}

/**
 * An @mention is written as the person's name, so the composer keeps the ids it resolved and
 * the body is left as typed — re-parsing a display name out of prose is how you mention the
 * wrong Grace.
 */
/** The one mention that names nobody in particular: it stands for the whole organization. */
export const MENTION_EVERYONE = 'everyone'

export const MENTION_EVERYONE_LABEL = 'Everyone in this organization'

export const MENTION_PATTERN = /@([\p{L}][\p{L}\p{N}'’.-]*(?: [\p{L}][\p{L}\p{N}'’.-]*)?)/gu

export function mentionedNames(body: string): string[] {
  return [...body.matchAll(MENTION_PATTERN)].map((match) => match[1] ?? '').filter(Boolean)
}
