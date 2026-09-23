import { z } from 'zod'

/** The four things a new hire needs before they are settled in, in the order they meet them. */
export const CHECKLIST_STEPS = ['profile', 'reading', 'shift', 'tasks'] as const

export type ChecklistStep = (typeof CHECKLIST_STEPS)[number]

/** What the new hire reads on their own checklist. */
export const STEP_TITLES: Record<ChecklistStep, string> = {
  profile: 'Finish your profile',
  reading: 'Read the required documents',
  shift: 'Get your shift',
  tasks: 'Work through your first-day tasks',
}

/** The column and filter labels on the admin's table. */
export const STEP_LABELS: Record<ChecklistStep, string> = {
  profile: 'Profile',
  reading: 'Reading',
  shift: 'Shift',
  tasks: 'Tasks',
}

/** A shift is given, never taken, so that step waits on an admin rather than the hire. */
export const STEP_OWNERS: Record<ChecklistStep, 'hire' | 'admin'> = {
  profile: 'hire',
  reading: 'hire',
  shift: 'admin',
  tasks: 'hire',
}

export const PROFILE_FIELDS = ['phone', 'photo'] as const

export type ProfileField = (typeof PROFILE_FIELDS)[number]

export const PROFILE_FIELD_LABELS: Record<ProfileField, string> = {
  phone: 'a phone number',
  photo: 'a photo',
}

export interface ChecklistDocument {
  id: string
  title: string
  acknowledged: boolean
}

export interface ChecklistTask {
  id: string
  title: string
  description: string | undefined
  done: boolean
}

/** Where one person stands on each step, before any dates are attached. */
export interface ChecklistProgress {
  profile: { done: boolean; missing: ProfileField[] }
  reading: { done: boolean; documents: ChecklistDocument[] }
  shift: { done: boolean; shiftName: string | undefined }
  tasks: { done: boolean; items: ChecklistTask[] }
}

export interface NewHireChecklistView extends ChecklistProgress {
  startedAt: string
  completedAt: string | undefined
}

export interface NewHireRow {
  userId: string
  name: string
  jobTitle: string | undefined
  teamName: string | undefined
  startedAt: string
  completedAt: string | undefined
  /** True when an admin closed it rather than every step finishing it. */
  closedByAdmin: boolean
  progress: ChecklistProgress
  doneCount: number
  /** The first step still open, which is where the hire is stuck. */
  stuckOn: ChecklistStep | undefined
}

export interface RequiredDocumentRow {
  documentId: string
  title: string
  /** "All departments" or the departments whose shelves hold it. */
  audience: string
}

export interface ChecklistTaskRow {
  id: string
  title: string
  description: string | undefined
}

export interface ChecklistSetup {
  requiredDocuments: RequiredDocumentRow[]
  /** Documents in the bluebook that are not required reading yet. */
  availableDocuments: { id: string; title: string }[]
  tasks: ChecklistTaskRow[]
}

export const NEW_HIRE_STATUSES = ['open', 'completed', 'all'] as const

export type NewHireStatus = (typeof NEW_HIRE_STATUSES)[number]

export const newHireQuerySchema = z.object({
  search: z.string().trim().max(100).catch('').default(''),
  status: z.enum(NEW_HIRE_STATUSES).catch('open').default('open'),
  stuckOn: z
    .enum(['', ...CHECKLIST_STEPS])
    .catch('')
    .default(''),
})

export type NewHireQuery = z.infer<typeof newHireQuerySchema>

export const DEFAULT_NEW_HIRE_QUERY: NewHireQuery = newHireQuerySchema.parse({})

export const userIdSchema = z.object({ userId: z.string().min(1) })

export const documentIdSchema = z.object({ documentId: z.string().min(1) })

export const taskDoneSchema = z.object({ taskId: z.string().min(1), done: z.boolean() })

export const taskIdSchema = z.object({ taskId: z.string().min(1) })

export const newTaskSchema = z.object({
  title: z.string().trim().min(1, 'Name the task').max(120, 'Keep it under 120 characters'),
  description: z.string().trim().max(500, 'Keep it under 500 characters').default(''),
})

export type NewTaskInput = z.input<typeof newTaskSchema>
export type NewTaskValues = z.infer<typeof newTaskSchema>
