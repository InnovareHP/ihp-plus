import { z } from 'zod'

/** The folder staff drop a client's documents into; everything else stays internal. */
export const CLIENTS_ROOT = 'Clients'
export const SHARED_SEGMENT = 'Shared'

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

export const clientIdSchema = z.uuid()
export const guestIdSchema = z.uuid()

export interface ClientAccessRow {
  id: string
  email: string
  role: string
  invitedAt: string
  revokedAt: string | undefined
}
