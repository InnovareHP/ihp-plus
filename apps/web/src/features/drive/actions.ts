'use server'

import {
  ensureFolder,
  GraphNotConfiguredError,
  inviteGuest,
  requireClientDriveId,
  revokePermission,
  rootItem,
  shareItem,
} from '@ihp/graph'
import { track } from '@/lib/analytics'
import { membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { clientFolderSharedTemplate, portalUrl, sendEmail } from '@/lib/email'
import { routes } from '@/lib/routes'
import { driveEvents } from './events'
import {
  clientAccessSchema,
  clientIdSchema,
  guestIdSchema,
  type ClientAccessInput,
  type ClientAccessRow,
} from './schema'
import {
  clientDriveFolder,
  clientForAccess,
  guestById,
  guestFor,
  guestsFor,
  markGuestRevoked,
  organizationName,
  saveClientDriveFolder,
  saveGuest,
} from './service'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

const NO_ORGANIZATION = 'Your account is not part of an organization yet.'
const INVALID = 'Check the highlighted fields and try again.'
const GONE = 'That client no longer exists.'
const NO_STORAGE = 'Document sync is not configured yet — tell an admin to set the GRAPH variables.'

async function requireOrganization() {
  const { user, profile } = await requireOnboarded()
  return { userId: user.id, organizationId: membershipOf(profile).organizationId }
}

function rowOf(guest: {
  id: string
  email: string
  role: string
  invitedAt: Date
  revokedAt: Date | null
}): ClientAccessRow {
  return {
    id: guest.id,
    email: guest.email,
    role: guest.role,
    invitedAt: guest.invitedAt.toISOString(),
    revokedAt: guest.revokedAt?.toISOString(),
  }
}

/** The client's folder in the shared library, created the first time someone shares it. */
async function folderFor(organizationId: string, client: { id: string; name: string }) {
  const targetDriveId = requireClientDriveId()
  const known = await clientDriveFolder(client.id)
  if (known && known.driveId === targetDriveId) return known

  const folder = await ensureFolder(targetDriveId, (await rootItem(targetDriveId)).id, client.name)
  return saveClientDriveFolder({
    organizationId,
    clientId: client.id,
    driveId: targetDriveId,
    itemId: folder.id,
    webUrl: folder.webUrl,
  })
}

export async function listClientAccess(clientId: string): Promise<Result<ClientAccessRow[]>> {
  const who = await requireOrganization()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = clientIdSchema.safeParse(clientId)
  if (!parsed.success) return { ok: false, message: INVALID }

  const client = await clientForAccess(who.organizationId, parsed.data)
  if (!client) return { ok: false, message: GONE }

  return { ok: true, data: (await guestsFor(client.id)).map(rowOf) }
}

/**
 * Shares one client's folder with one person. App-only access cannot invite a *new* guest to a
 * drive item, so an unknown address is created as a B2B guest first and shared with after.
 */
export async function shareClientFolder(
  input: ClientAccessInput,
): Promise<Result<ClientAccessRow>> {
  const who = await requireOrganization()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = clientAccessSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const client = await clientForAccess(who.organizationId, parsed.data.clientId)
  if (!client) return { ok: false, message: GONE }

  const email = parsed.data.email.toLowerCase()

  try {
    const folder = await folderFor(who.organizationId, client)
    const known = await guestFor(client.id, email)

    const invitedUserId =
      known?.invitedUserId ??
      (await inviteGuest(email, parsed.data.name ?? email, portalUrl(routes.dashboard))).invitedUser
        ?.id

    const shared = await shareItem(folder.driveId, folder.itemId, [email], 'read')
    const failure = shared.failed[0]
    if (failure) {
      track(driveEvents.accessShareFailed, { clientId: client.id })
      return { ok: false, message: `Microsoft refused that address — ${failure.message}` }
    }

    const guest = await saveGuest({
      clientId: client.id,
      email,
      invitedUserId,
      permissionId: shared.granted[0]?.id,
      role: 'read',
    })

    if (folder.webUrl) {
      await sendEmail({
        to: email,
        ...clientFolderSharedTemplate({
          organizationName: await organizationName(who.organizationId),
          clientName: client.name,
          url: folder.webUrl,
        }),
      })
    }

    track(driveEvents.accessShared, { clientId: client.id })
    return { ok: true, data: rowOf(guest) }
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) return { ok: false, message: NO_STORAGE }
    track(driveEvents.accessShareFailed, { clientId: client.id })
    return { ok: false, message: 'Could not share that folder — try again.' }
  }
}

/** Revoking is the permission delete; the row stays so the history shows who once had access. */
export async function revokeClientFolderAccess(guestId: string): Promise<Result<ClientAccessRow>> {
  const who = await requireOrganization()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = guestIdSchema.safeParse(guestId)
  if (!parsed.success) return { ok: false, message: INVALID }

  const guest = await guestById(parsed.data)
  if (!guest) return { ok: false, message: 'That access has already been removed.' }

  const client = await clientForAccess(who.organizationId, guest.clientId)
  if (!client) return { ok: false, message: GONE }

  const folder = await clientDriveFolder(guest.clientId)

  try {
    if (folder && guest.permissionId) {
      await revokePermission(folder.driveId, folder.itemId, guest.permissionId)
    }
    track(driveEvents.accessRevoked, { clientId: guest.clientId })
    return { ok: true, data: rowOf(await markGuestRevoked(guest.id)) }
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) return { ok: false, message: NO_STORAGE }
    track(driveEvents.accessRevokeFailed, { clientId: guest.clientId })
    return { ok: false, message: 'Could not remove that access — try again.' }
  }
}
