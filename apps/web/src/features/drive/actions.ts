'use server'

import {
  createFolder,
  createLink,
  deleteItem,
  ensureFolder,
  GraphError,
  GraphNotConfiguredError,
  inviteGuest,
  moveItem,
  requireClientDriveId,
  revokePermission,
  rootItem,
  shareItem,
} from '@ihp/graph'
import { track } from '@/lib/analytics'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { clientFolderSharedTemplate, portalUrl, sendEmail } from '@/lib/email'
import { safeLibraryName } from '@/lib/library-name'
import { routes } from '@/lib/routes'
import { driveEvents } from './events'
import { ensureInternalClientFolder } from './library'
import {
  clientAccessSchema,
  clientGroupSchema,
  clientIdSchema,
  groupAccessSchema,
  groupIdSchema,
  groupMemberSchema,
  guestIdSchema,
  organizationAccessQuerySchema,
  type ClientAccessInput,
  type ClientAccessRow,
  type ClientGroupRow,
  type ClientGroupsView,
  type GroupAccessInput,
  type GroupMemberInput,
  type OrganizationAccessPage,
} from './schema'
import {
  archiveGroup,
  clientByFolderName,
  clientDriveFolder,
  clientForAccess,
  clientGroups,
  groupFor,
  groupGuestFor,
  groupGuestsFor,
  groupMemberCount,
  groupNamed,
  guestById,
  guestFor,
  guestsFor,
  markGuestRevoked,
  moveClientDriveFolder,
  organizationAccess,
  organizationName,
  saveClientDriveFolder,
  saveGroup,
  saveGroupGuest,
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
const GROUP_GONE = 'That group no longer exists.'
const NOT_MANAGER = 'Only an admin can manage client groups.'
const NO_STORAGE = 'Document sync is not configured yet — tell an admin to set the GRAPH variables.'

async function requireOrganization() {
  const { user, profile } = await requireOnboarded()
  return { userId: user.id, organizationId: membershipOf(profile).organizationId }
}

/** Groups live on the admin-only folder access page, so managing one is an admin's job too. */
async function requireManager(): Promise<{ organizationId: string } | { message: string }> {
  const { profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  if (!membership.organizationId) return { message: NO_ORGANIZATION }
  if (!canManageOrganization(membership)) return { message: NOT_MANAGER }
  return { organizationId: membership.organizationId }
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

type Grant =
  | { ok: true; invitedUserId: string | undefined; permissionId: string | undefined; url: string }
  | { ok: false; message: string }

/**
 * Opens one folder to one person. App-only access cannot invite a *new* guest to a drive item, so
 * an unknown address is created as a B2B guest first and shared with after.
 */
async function grantFolder(
  folder: { driveId: string; itemId: string; webUrl: string | null },
  person: { email: string; name: string | undefined; invitedUserId: string | null | undefined },
): Promise<Grant> {
  if (sharesByLink()) {
    // No sign-in, and so no named person behind the access: the link is the credential.
    const permission = await createLink(folder.driveId, folder.itemId, {
      type: 'view',
      scope: 'anonymous',
      ...(linkExpiry() ? { expirationDateTime: linkExpiry() } : {}),
    })
    return {
      ok: true,
      invitedUserId: undefined,
      permissionId: permission.id,
      url: permission.link?.webUrl ?? folder.webUrl ?? '',
    }
  }

  const invitedUserId =
    person.invitedUserId ??
    (
      await inviteGuest(
        person.email,
        person.name ?? person.email,
        inviteRedirectUrl(process.env.GRAPH_INVITE_REDIRECT_URL ?? portalUrl(routes.dashboard)),
      )
    ).invitedUser?.id

  const shared = await shareItem(folder.driveId, folder.itemId, [person.email], 'read')
  const failure = shared.failed[0]
  if (failure) return { ok: false, message: `Microsoft refused that address — ${failure.message}` }

  return {
    ok: true,
    invitedUserId,
    permissionId: shared.granted[0]?.id,
    url: folder.webUrl ?? '',
  }
}

async function mailFolderLink(
  organizationId: string,
  ownerName: string,
  email: string,
  url: string,
) {
  if (!url) return
  await sendEmail({
    to: email,
    ...clientFolderSharedTemplate({
      organizationName: await organizationName(organizationId),
      clientName: ownerName,
      email,
      url,
      requiresSignIn: !sharesByLink(),
    }),
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

/** Shares one client's folder with one person. */
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

    const grant = await grantFolder(folder, {
      email,
      name: parsed.data.name,
      invitedUserId: known?.invitedUserId,
    })
    if (!grant.ok) {
      track(driveEvents.accessShareFailed, { clientId: client.id })
      return grant
    }

    const guest = await saveGuest({
      clientId: client.id,
      email,
      invitedUserId: grant.invitedUserId,
      permissionId: grant.permissionId,
      role: 'read',
    })
    await mailFolderLink(who.organizationId, client.name, email, grant.url)

    track(driveEvents.accessShared, { clientId: client.id })
    return { ok: true, data: rowOf(guest) }
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) return { ok: false, message: NO_STORAGE }
    track(driveEvents.accessShareFailed, { clientId: client.id })
    console.error('drive.shareClientFolder failed', error)
    return { ok: false, message: graphMessage(error, 'Could not share that folder — try again.') }
  }
}

/** The folder a grant sits on, or null when the client or group it belonged to is gone. */
async function folderOfGuest(
  organizationId: string,
  guest: { clientId: string | null; groupId: string | null },
): Promise<{
  folder: { driveId: string; itemId: string } | null
  owner: Record<string, string>
} | null> {
  if (guest.groupId) {
    const group = await groupFor(organizationId, guest.groupId)
    return group ? { folder: group, owner: { groupId: group.id } } : null
  }

  const client = await clientForAccess(organizationId, guest.clientId ?? '')
  if (!client) return null
  return { folder: await clientDriveFolder(client.id), owner: { clientId: client.id } }
}

/** Revoking is the permission delete; the row stays so the history shows who once had access. */
export async function revokeClientFolderAccess(guestId: string): Promise<Result<ClientAccessRow>> {
  const who = await requireOrganization()
  if (!who.organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = guestIdSchema.safeParse(guestId)
  if (!parsed.success) return { ok: false, message: INVALID }

  const guest = await guestById(parsed.data)
  if (!guest) return { ok: false, message: 'That access has already been removed.' }

  const target = await folderOfGuest(who.organizationId, guest)
  if (!target) return { ok: false, message: guest.groupId ? GROUP_GONE : GONE }
  const { folder, owner } = target

  try {
    if (folder && guest.permissionId) {
      await revokePermission(folder.driveId, folder.itemId, guest.permissionId)
    }
    track(driveEvents.accessRevoked, owner)
    return { ok: true, data: rowOf(await markGuestRevoked(guest.id)) }
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) return { ok: false, message: NO_STORAGE }
    track(driveEvents.accessRevokeFailed, owner)
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

export async function listClientGroups(): Promise<Result<ClientGroupsView>> {
  const who = await requireManager()
  if ('message' in who) return { ok: false, message: who.message }

  return { ok: true, data: await clientGroups(who.organizationId) }
}

/**
 * A group is a folder at the client library's root that company folders move into, so one share
 * of it opens every company at once — which is what an owner of several wants.
 */
export async function createClientGroup(input: unknown): Promise<Result<ClientGroupRow>> {
  const who = await requireManager()
  if ('message' in who) return { ok: false, message: who.message }

  const parsed = clientGroupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const name = safeLibraryName(parsed.data.name, 'Group')
  if (await groupNamed(who.organizationId, name)) {
    return { ok: false, message: 'A group with that name already exists.' }
  }
  // Client folders share the library root, so a client of the same name would claim this one.
  if (await clientByFolderName(who.organizationId, name)) {
    return { ok: false, message: 'A client already has that name — give the group another one.' }
  }

  try {
    const driveId = requireClientDriveId()
    const folder = await createFolder(driveId, (await rootItem(driveId)).id, name)
    const group = await saveGroup({
      organizationId: who.organizationId,
      name,
      driveId,
      itemId: folder.id,
      webUrl: folder.webUrl,
    })

    track(driveEvents.groupCreated, { groupId: group.id })
    return {
      ok: true,
      data: {
        id: group.id,
        name: group.name,
        webUrl: group.webUrl ?? undefined,
        activeGrants: 0,
        members: [],
      },
    }
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) return { ok: false, message: NO_STORAGE }
    track(driveEvents.groupCreateFailed)
    if (error instanceof GraphError && error.isConflict) {
      return {
        ok: false,
        message: 'The client library already has a folder with that name — pick another one.',
      }
    }
    console.error('drive.createClientGroup failed', error)
    return { ok: false, message: graphMessage(error, 'Could not create that group — try again.') }
  }
}

/** Moves the company's folder under the group's, or makes it there if it has none yet. */
export async function addClientToGroup(input: GroupMemberInput): Promise<Result<null>> {
  const who = await requireManager()
  if ('message' in who) return { ok: false, message: who.message }

  const parsed = groupMemberSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const group = await groupFor(who.organizationId, parsed.data.groupId)
  if (!group) return { ok: false, message: GROUP_GONE }
  const client = await clientForAccess(who.organizationId, parsed.data.clientId)
  if (!client) return { ok: false, message: GONE }

  try {
    const known = await clientDriveFolder(client.id)

    if (known && known.driveId === group.driveId) {
      if (known.groupId !== group.id) {
        // The item id survives the move, so the mirror keeps copying into the same folder.
        const moved = await moveItem(known.driveId, known.itemId, group.itemId)
        await moveClientDriveFolder(client.id, { groupId: group.id, webUrl: moved.webUrl })
      }
    } else {
      await internalFolderFor(client.name)
      const folder = await ensureFolder(group.driveId, group.itemId, client.name)
      track(driveEvents.clientFolderCreated, { clientId: client.id })
      await saveClientDriveFolder({
        organizationId: who.organizationId,
        clientId: client.id,
        driveId: group.driveId,
        itemId: folder.id,
        webUrl: folder.webUrl,
        groupId: group.id,
      })
    }

    track(driveEvents.groupMemberAdded, { groupId: group.id, clientId: client.id })
    return { ok: true, data: null }
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) return { ok: false, message: NO_STORAGE }
    track(driveEvents.groupMemberFailed, { groupId: group.id, clientId: client.id })
    console.error('drive.addClientToGroup failed', error)
    return {
      ok: false,
      message: graphMessage(error, `Could not add ${client.name} to the group — try again.`),
    }
  }
}

/** The folder goes back to the library root; people the group was shared with lose it. */
export async function removeClientFromGroup(input: GroupMemberInput): Promise<Result<null>> {
  const who = await requireManager()
  if ('message' in who) return { ok: false, message: who.message }

  const parsed = groupMemberSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const group = await groupFor(who.organizationId, parsed.data.groupId)
  if (!group) return { ok: false, message: GROUP_GONE }
  const client = await clientForAccess(who.organizationId, parsed.data.clientId)
  if (!client) return { ok: false, message: GONE }

  const folder = await clientDriveFolder(client.id)
  if (!folder || folder.groupId !== group.id) return { ok: true, data: null }

  try {
    const moved = await moveItem(folder.driveId, folder.itemId, (await rootItem(folder.driveId)).id)
    await moveClientDriveFolder(client.id, { groupId: null, webUrl: moved.webUrl })

    track(driveEvents.groupMemberRemoved, { groupId: group.id, clientId: client.id })
    return { ok: true, data: null }
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) return { ok: false, message: NO_STORAGE }
    track(driveEvents.groupMemberFailed, { groupId: group.id, clientId: client.id })
    console.error('drive.removeClientFromGroup failed', error)
    return {
      ok: false,
      message: graphMessage(error, `Could not take ${client.name} out of the group — try again.`),
    }
  }
}

/**
 * Only an empty group can go, so no company's documents are ever deleted with it. Its folder's
 * permissions die with the folder; the grant rows stay as history.
 */
export async function deleteClientGroup(groupId: string): Promise<Result<null>> {
  const who = await requireManager()
  if ('message' in who) return { ok: false, message: who.message }

  const parsed = groupIdSchema.safeParse(groupId)
  if (!parsed.success) return { ok: false, message: INVALID }

  const group = await groupFor(who.organizationId, parsed.data)
  if (!group) return { ok: false, message: GROUP_GONE }
  if ((await groupMemberCount(group.id)) > 0) {
    return { ok: false, message: 'Take every company out of the group before deleting it.' }
  }

  try {
    try {
      await deleteItem(group.driveId, group.itemId)
    } catch (error) {
      if (!(error instanceof GraphError) || !error.isNotFound) throw error
    }

    const grants = await groupGuestsFor(group.id)
    await Promise.all(
      grants.filter((guest) => !guest.revokedAt).map((guest) => markGuestRevoked(guest.id)),
    )
    await archiveGroup(group.id)

    track(driveEvents.groupDeleted, { groupId: group.id })
    return { ok: true, data: null }
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) return { ok: false, message: NO_STORAGE }
    track(driveEvents.groupDeleteFailed, { groupId: group.id })
    console.error('drive.deleteClientGroup failed', error)
    return { ok: false, message: graphMessage(error, 'Could not delete that group — try again.') }
  }
}

export async function listGroupAccess(groupId: string): Promise<Result<ClientAccessRow[]>> {
  const who = await requireManager()
  if ('message' in who) return { ok: false, message: who.message }

  const parsed = groupIdSchema.safeParse(groupId)
  if (!parsed.success) return { ok: false, message: INVALID }

  const group = await groupFor(who.organizationId, parsed.data)
  if (!group) return { ok: false, message: GROUP_GONE }

  return { ok: true, data: (await groupGuestsFor(group.id)).map(rowOf) }
}

/** One share of the group's folder opens every company inside it — the single link an owner wants. */
export async function shareGroupFolder(input: GroupAccessInput): Promise<Result<ClientAccessRow>> {
  const who = await requireManager()
  if ('message' in who) return { ok: false, message: who.message }

  const parsed = groupAccessSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const group = await groupFor(who.organizationId, parsed.data.groupId)
  if (!group) return { ok: false, message: GROUP_GONE }

  const email = parsed.data.email.toLowerCase()

  try {
    const known = await groupGuestFor(group.id, email)
    const grant = await grantFolder(group, {
      email,
      name: parsed.data.name,
      invitedUserId: known?.invitedUserId,
    })
    if (!grant.ok) {
      track(driveEvents.accessShareFailed, { groupId: group.id })
      return grant
    }

    const guest = await saveGroupGuest({
      groupId: group.id,
      email,
      invitedUserId: grant.invitedUserId,
      permissionId: grant.permissionId,
      role: 'read',
    })
    await mailFolderLink(who.organizationId, group.name, email, grant.url)

    track(driveEvents.accessShared, { groupId: group.id })
    return { ok: true, data: rowOf(guest) }
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) return { ok: false, message: NO_STORAGE }
    track(driveEvents.accessShareFailed, { groupId: group.id })
    console.error('drive.shareGroupFolder failed', error)
    return { ok: false, message: graphMessage(error, 'Could not share that folder — try again.') }
  }
}
