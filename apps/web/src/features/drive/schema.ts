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
  clientId: string
  clientName: string
  /** The SharePoint folder this grant is on, when the portal has recorded it. */
  folderUrl: string | undefined
}

export interface OrganizationAccessPage {
  rows: OrganizationAccessRow[]
  pageInfo: PageInfo
}
