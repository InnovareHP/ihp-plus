import { z } from 'zod'
import { EMPLOYMENT_TYPES } from '@/features/onboarding/options'
import { paginationSchema, sortDirectionSchema, type PageInfo } from '@/lib/pagination'

// Mirrors the roles configured on the plugins in lib/auth.ts.
export const ORGANIZATION_ROLES = ['owner', 'admin', 'member'] as const
// The admin plugin types set-role as 'admin' | 'user'; "Member" is the label for 'user'.
export const PORTAL_ROLES = ['admin', 'user'] as const

export const PORTAL_ROLE_LABELS: Record<PortalRole, string> = { admin: 'Admin', user: 'Member' }

export const MEMBER_STATUSES = ['all', 'active', 'suspended'] as const
// Department is a to-many relation, and Prisma cannot order by one, so it is filter-only.
export const MEMBER_SORT_KEYS = [
  'name',
  'email',
  'organizationRole',
  'portalRole',
  'jobTitle',
  'startDate',
  'createdAt',
] as const

/** A filter arrives as `?x=a,b` or repeated `?x=a&x=b`; an unknown value is dropped, never thrown. */
function csvOf<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) => (typeof raw === 'string' ? raw.split(',') : (raw ?? [])))
    .transform((list) =>
      list.filter((item): item is T[number] => (values as readonly string[]).includes(item)),
    )
}

const csvIds = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((raw) => (typeof raw === 'string' ? raw.split(',') : (raw ?? [])))
  // Capped so a crafted URL cannot turn one filter into a thousand-branch IN clause.
  .transform((list) =>
    list
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50),
  )

export const memberQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).catch('').default(''),
  organizationRoles: csvOf(ORGANIZATION_ROLES),
  portalRoles: csvOf(PORTAL_ROLES),
  employmentTypes: csvOf(EMPLOYMENT_TYPES),
  teamIds: csvIds,
  status: z.enum(MEMBER_STATUSES).catch('all'),
  startDateFrom: z.iso.date().optional().catch(undefined),
  startDateTo: z.iso.date().optional().catch(undefined),
  sortBy: z.enum(MEMBER_SORT_KEYS).catch('name'),
  sortDirection: sortDirectionSchema.catch('asc'),
})

export const setOrganizationRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(ORGANIZATION_ROLES),
})

export const setPortalRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(PORTAL_ROLES),
})

export const setBannedSchema = z.object({
  userId: z.string().min(1),
  banned: z.boolean(),
})

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number]
export type PortalRole = (typeof PORTAL_ROLES)[number]
export type MemberStatus = (typeof MEMBER_STATUSES)[number]
export type MemberSortKey = (typeof MEMBER_SORT_KEYS)[number]
export type MemberQuery = z.infer<typeof memberQuerySchema>
export type SetOrganizationRoleValues = z.infer<typeof setOrganizationRoleSchema>
export type SetPortalRoleValues = z.infer<typeof setPortalRoleSchema>
export type SetBannedValues = z.infer<typeof setBannedSchema>

export const DEFAULT_MEMBER_QUERY: MemberQuery = memberQuerySchema.parse({})

/** Whether the query narrows the list, which decides between the empty and the no-results state. */
export function isFilteredQuery(query: MemberQuery) {
  return (
    query.search !== '' ||
    query.status !== 'all' ||
    query.organizationRoles.length > 0 ||
    query.portalRoles.length > 0 ||
    query.employmentTypes.length > 0 ||
    query.teamIds.length > 0 ||
    query.startDateFrom !== undefined ||
    query.startDateTo !== undefined
  )
}

export interface MemberRow {
  memberId: string
  userId: string
  name: string
  email: string
  organizationRole: OrganizationRole
  portalRole: PortalRole
  team: string | undefined
  jobTitle: string | undefined
  ihpId: string | undefined
  /** ISO date; a Date would cross the server-action boundary as a less predictable value. */
  startDate: string | undefined
  banned: boolean
  isSelf: boolean
}

export interface MembersPage {
  rows: MemberRow[]
  pageInfo: PageInfo
}

export interface MemberFilterOptions {
  teams: { id: string; name: string; memberCount: number }[]
  employmentTypes: readonly string[]
}
