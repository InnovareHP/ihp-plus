import { z } from 'zod'

export const searchEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['page', 'person', 'client']),
  label: z.string().min(1),
  description: z.string().optional(),
  /** The sidebar area a page sits in, shown as a badge beside its name. */
  area: z.string().optional(),
  // Recent entries come back out of localStorage, which anyone can edit, so only in-app paths pass.
  href: z.string().refine((value) => value.startsWith('/') && !value.startsWith('//')),
  keywords: z.array(z.string()).optional(),
  // Same in-app rule as href: it becomes an img src, so nothing off-site is ever loaded.
  photoUrl: z
    .string()
    .refine((value) => value.startsWith('/') && !value.startsWith('//'))
    .optional(),
})

export type SearchEntry = z.infer<typeof searchEntrySchema>

export const TASK_RESULT_LIMIT = 8

export const taskSearchSchema = z.object({
  query: z.string().trim().min(2).max(100),
  // The wire sends 0 for "not set", which means the default.
  limit: z
    .number()
    .int()
    .min(0)
    .max(20)
    .transform((limit) => limit || TASK_RESULT_LIMIT),
})

export interface SearchPerson {
  userId: string
  name: string
  jobTitle: string
  department: string
  photoUrl: string
}

export interface SearchClient {
  clientId: string
  name: string
  status: string
}

export interface SearchDirectory {
  people: SearchPerson[]
  clients: SearchClient[]
}

export interface SearchTask {
  taskId: string
  taskNumber: number
  name: string
  projectId: string
  projectName: string
  statusName: string
  statusColor: string
}
