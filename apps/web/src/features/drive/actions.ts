'use server'

import {
  createLink,
  ensureFolder,
  GraphError,
  GraphNotConfiguredError,
  inviteGuest,
  requireClientDriveId,
  revokePermission,
  rootItem,
  shareItem,
} from '@ihp/graph'
import { track } from '@/lib/analytics'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { clientFolderSharedTemplate, portalUrl, sendEmail } from '@/lib/email'
import { routes } from '@/lib/routes'
import { driveEvents } from './events'
import { ensureInternalClientFolder } from './library'
import {
  clientAccessSchema,
  clientIdSchema,
  guestIdSchema,
  organizationAccessQuerySchema,
  type ClientAccessInput,
  type ClientAccessRow,
  type OrganizationAccessPage,
} from './schema'
import {
  clientDriveFolder,
  clientForAccess,
  organizationAccess,
  guestById,
  guestFor,
  guestsFor,
  markGuestRevoked,
  organizationName,
  saveClientDriveFolder,
  saveGuest,
} from './service'
import { inviteRedirectUrl } from './utils/invite-redirect'
import { linkExpiry, sharesByLink } from './utils/share-mode'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }
export type OrganizationAccessResult =
  ({ ok: true } & OrganizationAccessPage) | { ok: false; message: string }

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

/**
 * Microsoft's own code is the only useful part of a sharing failure — "try again" sends an
 * admin hunting through Entra for a setting the response already named.
 */
function graphMessage(error: unknown, fallback: string) {
  if (!(error instanceof GraphError)) return fallback
  if (error.status === 403) {
    return `Microsoft refused that (${error.code}) — check external sharing is on for the client site.`
  }
  return `Microsoft refused that (${error.code}) — ${error.message}`
}

/**
 * The staff folder the client's one mirrors. Best-effort: the share still works without it, and
 * the internal library is where staff put documents, not where the client reads them.
 */
async function internalFolderFor(clientName: string) {
  try {
    await ensureInternalClientFolder(clientName)
  } catch (error) {
    track(driveEvents.internalFolderFailed, {
      reason: error instanceof Error ? error.message.slice(0, 120) : 'Unknown error.',
    })
  }
}

/** The client's folder in the shared library, created the first time someone shares it. */
async function folderFor(organizationId: string, client: { id: string; name: string }) {
  const targetDriveId = requireClientDriveId()
  const known = await clientDriveFolder(client.id)
  if (known && known.driveId === targetDriveId) return known

  // Both sides are made together, so staff have somewhere to file the moment a client can read.
  await internalFolderFor(client.name)
  const folder = await ensureFolder(targetDriveId, (await rootItem(targetDriveId)).id, client.name)
  track(driveEvents.clientFolderCreated, { clientId: client.id })
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

    let invitedUserId: string | undefined
    let permissionId: string | undefined
    let openUrl = folder.webUrl

    if (sharesByLink()) {
      // No sign-in, and so no named person behind the access: the link is the credential.
      const permission = await createLink(folder.driveId, folder.itemId, {
        type: 'view',
        scope: 'anonymous',
        ...(linkExpiry() ? { expirationDateTime: linkExpiry() } : {}),
      })
      permissionId = permission.id
      openUrl = permission.link?.webUrl ?? folder.webUrl
    } else {
      invitedUserId =
        known?.invitedUserId ??
        (
          await inviteGuest(
            email,
            parsed.data.name ?? email,
            inviteRedirectUrl(process.env.GRAPH_INVITE_REDIRECT_URL ?? portalUrl(routes.dashboard)),
          )
        ).invitedUser?.id

      const shared = await shareItem(folder.driveId, folder.itemId, [email], 'read')
      const failure = shared.failed[0]
      if (failure) {
        track(driveEvents.accessShareFailed, { clientId: client.id })
        return { ok: false, message: `Microsoft refused that address — ${failure.message}` }
      }
      permissionId = shared.granted[0]?.id
    }

    const guest = await saveGuest({
      clientId: client.id,
      email,
      invitedUserId,
      permissionId,
      role: 'read',
    })

    if (openUrl) {
      await sendEmail({
        to: email,
        ...clientFolderSharedTemplate({
          organizationName: await organizationName(who.organizationId),
          clientName: client.name,
          url: openUrl,
          requiresSignIn: !sharesByLink(),
        }),
      })
    }

    track(driveEvents.accessShared, { clientId: client.id })
    return { ok: true, data: rowOf(guest) }
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) return { ok: false, message: NO_STORAGE }
    track(driveEvents.accessShareFailed, { clientId: client.id })
    console.error('drive.shareClientFolder failed', error)
    return { ok: false, message: graphMessage(error, 'Could not share that folder — try again.') }
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
    console.error('drive.revokeClientFolderAccess failed', error)
    return { ok: false, message: graphMessage(error, 'Could not remove that access — try again.') }
  }
}

/**
 * Every grant the organization has handed out, in one place. Sharing is a per-client job, but
 * "who outside the company can see anything?" is a question only this page answers.
 */
export async function listOrganizationAccess(input?: unknown): Promise<OrganizationAccessResult> {
  const { profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  if (!membership.organizationId) return { ok: false, message: NO_ORGANIZATION }
  if (!canManageOrganization(membership)) {
    return { ok: false, message: 'Only an admin can see every folder grant.' }
  }

  const query = organizationAccessQuerySchema.parse(input ?? {})
  const { rows, pageInfo } = await organizationAccess(membership.organizationId, query)

  return { ok: true, rows, pageInfo }
}
