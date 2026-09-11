import { z } from 'zod'

// Owner is granted by seeding or promotion, never by invitation.
export const INVITABLE_ROLES = ['admin', 'member'] as const

export const organizationProfileSchema = z.object({
  name: z.string().trim().min(2, 'Give the organization a name.').max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'The slug needs at least two characters.')
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.'),
  logo: z.union([z.url('Enter a full image URL, or leave it blank.'), z.literal('')]),
})

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, 'Give the department a name.').max(60),
})

export const renameTeamSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().trim().min(2, 'Give the department a name.').max(60),
})

export const deleteTeamSchema = z.object({ teamId: z.string().min(1) })

export const assignDepartmentSchema = z.object({
  userId: z.string().min(1),
  teamId: z.string().min(1),
})

export const removeFromTeamSchema = z.object({
  userId: z.string().min(1),
  teamId: z.string().min(1),
})

export const inviteMemberSchema = z.object({
  email: z.email('Enter a work email address.'),
  role: z.enum(INVITABLE_ROLES),
  teamId: z.string().min(1, 'Pick the department they will join.'),
})

export const invitationIdSchema = z.object({ invitationId: z.string().min(1) })

export type OrganizationProfileValues = z.infer<typeof organizationProfileSchema>
export type CreateTeamValues = z.infer<typeof createTeamSchema>
export type RenameTeamValues = z.infer<typeof renameTeamSchema>
export type AssignDepartmentValues = z.infer<typeof assignDepartmentSchema>
export type RemoveFromTeamValues = z.infer<typeof removeFromTeamSchema>
export type InviteMemberValues = z.infer<typeof inviteMemberSchema>
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

export interface OrganizationSummary {
  id: string
  name: string
  slug: string
  logo: string
  memberCount: number
  teamCount: number
  pendingInvitationCount: number
  unassignedCount: number
}

export interface TeamRow {
  id: string
  name: string
  memberCount: number
  createdAt: string
}

export interface TeamPersonRow {
  userId: string
  name: string
  email: string
  jobTitle: string | null
}

export interface AssignableUserRow {
  userId: string
  name: string
  email: string
  teamId: string | undefined
  teamName: string | undefined
}

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'canceled'

export interface InvitationRow {
  id: string
  email: string
  role: string
  teamName: string | undefined
  status: InvitationStatus
  expiresAt: string
  expired: boolean
  invitedBy: string
}

/**
 * List state for the departments table. `team` is the department whose roster drawer is open —
 * not a filter, but it lives here so adjusting a filter rewrites the query string without
 * dropping it.
 */
export const teamQuerySchema = z.object({
  search: z.string().trim().max(100).catch('').default(''),
  emptyOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((value) => value === true || value === 'true')
    .catch(false),
  unledOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((value) => value === true || value === 'true')
    .catch(false),
  team: z.string().trim().max(64).catch('').default(''),
})

export const invitationQuerySchema = z.object({
  search: z.string().trim().max(100).catch('').default(''),
  role: z.string().trim().max(32).catch('').default(''),
  expiredOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((value) => value === true || value === 'true')
    .catch(false),
})

export type TeamQuery = z.infer<typeof teamQuerySchema>
export type InvitationQuery = z.infer<typeof invitationQuerySchema>

export const DEFAULT_TEAM_QUERY: TeamQuery = teamQuerySchema.parse({})
export const DEFAULT_INVITATION_QUERY: InvitationQuery = invitationQuerySchema.parse({})
