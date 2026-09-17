import { z } from 'zod'

export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const
export const TASK_STATUS_CATEGORIES = ['active', 'done', 'cancelled'] as const
export const TASK_ASSIGNEE_FILTERS = ['all', 'mine', 'unassigned'] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]
export type TaskStatusCategory = (typeof TASK_STATUS_CATEGORIES)[number]
export type TaskAssigneeFilter = (typeof TASK_ASSIGNEE_FILTERS)[number]

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

export const taskFormSchema = z.object({
  projectId: z.string().min(1),
  listId: z.string().min(1, 'Pick a list.'),
  name: z.string().trim().min(1, 'Say what has to be done.').max(200, 'Keep the title shorter.'),
  description: z
    .string()
    .trim()
    .max(2000, 'Keep the description under 2000 characters.')
    .default(''),
  priority: z.enum(TASK_PRIORITIES).default('normal'),
  // Empty means no due date; the task simply has no deadline.
  dueDate: z.string().trim().default(''),
  assigneeIds: z.array(z.string().min(1)).default([]),
})

// The board's own state — which project, which list, whose work, what was typed — lives in the
// URL so a board someone is looking at can be linked to.
export const boardQuerySchema = z.object({
  project: z.string().trim().max(64).catch('').default(''),
  list: z.string().trim().max(64).catch('').default(''),
  assignee: z.enum(TASK_ASSIGNEE_FILTERS).catch('all').default('all'),
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
export type TaskFormValues = z.infer<typeof taskFormSchema>
export type TaskFormInput = z.input<typeof taskFormSchema>

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
}

export interface TaskQuery {
  projectId: string
  listId: string | undefined
  assignee: TaskAssigneeFilter
  search: string
  includeArchived: boolean
}

export interface UpdateTaskValues {
  taskId: string
  name?: string
  description?: string
  priority?: TaskPriority
  statusId?: string
  dueDate?: string
  isArchived?: boolean
  assigneeIds?: readonly string[]
}

export interface ReorderTaskValues {
  taskId: string
  listId: string
  beforeTaskId: string | undefined
}

/** A task counts as done when its status says so, whatever the organization named that status. */
export function isTaskDone(task: TaskRow) {
  return task.status.category === 'done'
}

export function isTaskOverdue(task: TaskRow, now: Date = new Date()) {
  if (!task.dueDate || isTaskDone(task)) return false
  return new Date(task.dueDate).getTime() < now.getTime()
}
