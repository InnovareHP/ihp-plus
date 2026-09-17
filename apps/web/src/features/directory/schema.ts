import { z } from 'zod'
import { paginationSchema, type PageInfo } from '@/lib/pagination'

const csvValues = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((raw) => (typeof raw === 'string' ? raw.split(',') : (raw ?? [])))
  // Capped so a crafted URL cannot turn one filter into a thousand-branch IN clause.
  .transform((list) =>
    list
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 50),
  )

/** The filter value for people who have not been placed in a department yet. */
export const UNASSIGNED = 'unassigned'

export const directoryQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).catch('').default(''),
  teamIds: csvValues,
})

export type DirectoryQuery = z.infer<typeof directoryQuerySchema>

export const DEFAULT_DIRECTORY_QUERY: DirectoryQuery = directoryQuerySchema.parse({})

export function isFilteredDirectoryQuery(query: DirectoryQuery) {
  return query.search !== '' || query.teamIds.length > 0
}

export interface PersonRow {
  userId: string
  name: string
  jobTitle: string
  department: string
  email: string
  phone: string
  ihpId: string
  employmentType: string
  /** Short-lived signed link; empty when the profile carries no photo. */
  photoUrl: string
  startDate: string
  /** Leads their department, which is worth showing next to their name. */
  isLead: boolean
}

export interface DirectoryPage {
  rows: PersonRow[]
  pageInfo: PageInfo
}

export interface DepartmentOption {
  teamId: string
  name: string
  memberCount: number
}

export interface ChartPerson {
  userId: string
  name: string
  jobTitle: string
}

export interface ChartDepartment {
  teamId: string
  name: string
  leads: ChartPerson[]
  /** Everyone in the department who does not lead it. */
  members: ChartPerson[]
}

export interface OrgChart {
  organizationName: string
  departments: ChartDepartment[]
  unassignedCount: number
}

export interface DirectoryDepartments {
  departments: DepartmentOption[]
  unassignedCount: number
}

/** Two initials for the avatar fallback, so a missing photo still reads as a person. */
export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}
