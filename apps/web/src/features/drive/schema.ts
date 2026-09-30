import { z } from 'zod'
import { paginationSchema, sortDirectionSchema, type PageInfo } from '@/lib/pagination'

/** The folder staff drop a client's documents into; everything else stays internal. */
export const CLIENTS_ROOT = 'Clients'

export const MIRROR_STATES = ['pending', 'copying', 'synced', 'failed', 'removed'] as const

export type MirrorState = (typeof MIRROR_STATES)[number]

/** Graph posts an array; a lifecycle event carries no resource change of its own. */
export const notificationSchema = z.object({
  subscriptionId: z.string().min(1),
  clientState: z.string().optional(),
  resource: z.string().optional(),
  changeType: z.string().optional(),
  lifecycleEvent: z.enum(['reauthorizationRequired', 'subscriptionRemoved', 'missed']).optional(),
})

export const notificationBatchSchema = z.object({
  value: z.array(notificationSchema).max(100),
})

export type DriveNotification = z.infer<typeof notificationSchema>

export interface SyncOutcome {
  copied: number
  updated: number
  removed: number
  skipped: number
  failed: number
}

export const EMPTY_OUTCOME: SyncOutcome = {
  copied: 0,
  updated: 0,
  removed: 0,
  skipped: 0,
  failed: 0,
}

export const clientAccessSchema = z.object({
  clientId: z.uuid(),
  email: z.email(),
  name: z.string().trim().max(120).optional(),
})

export type ClientAccessInput = z.infer<typeof clientAccessSchema>

/** The form asks for the person, not the client — the modal already knows which folder. */
export const shareFolderSchema = clientAccessSchema.omit({ clientId: true })

export type ShareFolderValues = z.infer<typeof shareFolderSchema>

export const EMPTY_SHARE_FOLDER: ShareFolderValues = { email: '', name: '' }

export const clientIdSchema = z.uuid()
export const guestIdSchema = z.uuid()

export interface ClientAccessRow {
  id: string
  email: string
  role: string
  invitedAt: string
  revokedAt: string | undefined
}

export const ACCESS_VIEWS = ['active', 'removed', 'all'] as const
export const ACCESS_SORT_KEYS = ['email', 'invitedAt'] as const

export type AccessView = (typeof ACCESS_VIEWS)[number]
export type AccessSortKey = (typeof ACCESS_SORT_KEYS)[number]

/** Every filter the folder access page offers lives in the URL, so a view can be linked. */
export const organizationAccessQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).catch(''),
  view: z.enum(ACCESS_VIEWS).catch('active'),
  sortBy: z.enum(ACCESS_SORT_KEYS).catch('invitedAt'),
  sortDirection: sortDirectionSchema.catch('desc'),
})

export type OrganizationAccessQuery = z.infer<typeof organizationAccessQuerySchema>

export const DEFAULT_ORGANIZATION_ACCESS_QUERY = organizationAccessQuerySchema.parse({})

export interface OrganizationAccessRow extends ClientAccessRow {
  clientId: string | undefined
  /** Set on a grant to a group's folder, in which case `clientName` is the group's name. */
  groupId: string | undefined
  clientName: string
  /** The SharePoint folder this grant is on, when the portal has recorded it. */
  folderUrl: string | undefined
}

export interface OrganizationAccessPage {
  rows: OrganizationAccessRow[]
  pageInfo: PageInfo
}

export const clientGroupSchema = z.object({
  name: z.string().trim().min(1, 'Name the group.').max(120, 'Keep the name under 120 characters.'),
})

export type ClientGroupValues = z.infer<typeof clientGroupSchema>

export const EMPTY_CLIENT_GROUP: ClientGroupValues = { name: '' }

export const groupIdSchema = z.uuid()

export const groupMemberSchema = z.object({ groupId: z.uuid(), clientId: z.uuid() })

export type GroupMemberInput = z.infer<typeof groupMemberSchema>

/** The card already knows its group, so the form only picks the company. */
export const addMemberSchema = z.object({ clientId: z.string().min(1, 'Pick a company to add.') })

export type AddMemberValues = z.infer<typeof addMemberSchema>

export const groupAccessSchema = shareFolderSchema.extend({ groupId: z.uuid() })

export type GroupAccessInput = z.infer<typeof groupAccessSchema>

export interface ClientGroupRow {
  id: string
  name: string
  webUrl: string | undefined
  /** People who can open the group folder now, which a delete would take away. */
  activeGrants: number
  members: { id: string; name: string }[]
}

export interface GroupableClient {
  id: string
  name: string
  groupId: string | undefined
}

export interface ClientGroupsView {
  groups: ClientGroupRow[]
  clients: GroupableClient[]
}
