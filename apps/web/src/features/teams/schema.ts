import { z } from 'zod'

export const departmentLeadSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
})

export type DepartmentLeadValues = z.infer<typeof departmentLeadSchema>

export interface DepartmentLeadsView {
  teams: { id: string; name: string }[]
  members: { id: string; name: string; email: string }[]
  /** One row per lead; a department can have several, and a person can lead several. */
  leads: { teamId: string; userId: string }[]
}
