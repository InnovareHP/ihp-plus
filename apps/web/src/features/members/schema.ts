import { z } from 'zod'

// Mirrors the roles configured on the plugins in lib/auth.ts.
export const ORGANIZATION_ROLES = ['owner', 'admin', 'member'] as const
// The admin plugin types set-role as 'admin' | 'user'; "Member" is the label for 'user'.
export const PORTAL_ROLES = ['admin', 'user'] as const

export const PORTAL_ROLE_LABELS: Record<PortalRole, string> = { admin: 'Admin', user: 'Member' }

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
export type SetOrganizationRoleValues = z.infer<typeof setOrganizationRoleSchema>
export type SetPortalRoleValues = z.infer<typeof setPortalRoleSchema>
export type SetBannedValues = z.infer<typeof setBannedSchema>

export interface MemberRow {
  memberId: string
  userId: string
  name: string
  email: string
  organizationRole: OrganizationRole
  portalRole: PortalRole
  team: string | undefined
  banned: boolean
  isSelf: boolean
}
