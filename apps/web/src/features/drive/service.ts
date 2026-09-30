import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { pageInfoOf, skipTake } from '@/lib/pagination'
import type { MirrorState, OrganizationAccessQuery } from './schema'

export function subscriptionForDrive(driveId: string) {
  return db.driveSubscription.findUnique({ where: { driveId } })
}

export function subscriptionByGraphId(subscriptionId: string) {
  return db.driveSubscription.findFirst({ where: { subscriptionId } })
}

export function saveSweep(driveId: string, deltaLink: string | undefined) {
  return db.driveSubscription.update({
    where: { driveId },
    data: { deltaLink: deltaLink ?? null, lastSweptAt: new Date(), lastError: null },
  })
}

export function saveSweepError(driveId: string, message: string) {
  return db.driveSubscription.update({
    where: { driveId },
    data: { lastError: message.slice(0, 500), lastSweptAt: new Date() },
  })
}

/**
 * The folder name staff typed in Explorer is the only link to a client, so it is matched
 * case-insensitively and an archived client is ignored rather than silently shared with.
 */
export function clientByFolderName(organizationId: string, folderName: string) {
  return db.client.findFirst({
    where: { organizationId, archivedAt: null, name: { equals: folderName, mode: 'insensitive' } },
    select: { id: true, name: true },
  })
}

export function clientDriveFolder(clientId: string) {
  return db.clientDriveFolder.findUnique({ where: { clientId } })
}

export function saveClientDriveFolder(input: {
  organizationId: string
  clientId: string
  driveId: string
  itemId: string
  webUrl: string | undefined
  groupId?: string | null
}) {
  const { clientId, groupId, ...rest } = input
  // Left out means "keep the group it has": the mirror re-saves a folder without knowing it.
  const group = groupId === undefined ? {} : { groupId }
  return db.clientDriveFolder.upsert({
    where: { clientId },
    create: { clientId, ...rest, ...group, webUrl: rest.webUrl ?? null },
    update: { itemId: rest.itemId, ...group, webUrl: rest.webUrl ?? null },
  })
}

export function moveClientDriveFolder(
  clientId: string,
  input: { groupId: string | null; webUrl: string | undefined },
) {
  return db.clientDriveFolder.update({
    where: { clientId },
    data: { groupId: input.groupId, webUrl: input.webUrl ?? null },
  })
}

export function mirrorFor(sourceDriveId: string, sourceItemId: string) {
  return db.driveMirror.findUnique({
    where: { sourceDriveId_sourceItemId: { sourceDriveId, sourceItemId } },
  })
}

export function saveMirror(input: {
  organizationId: string
  clientId: string
  sourceDriveId: string
  sourceItemId: string
  sourceEtag: string | undefined
  sourcePath: string
  targetDriveId: string
  targetItemId: string | undefined
  state: MirrorState
  lastError?: string | undefined
}) {
  const { sourceDriveId, sourceItemId, lastError, ...rest } = input
  const common = {
    ...rest,
    sourceEtag: rest.sourceEtag ?? null,
    targetItemId: rest.targetItemId ?? null,
    lastError: lastError?.slice(0, 500) ?? null,
    syncedAt: rest.state === 'synced' ? new Date() : null,
    removedAt: rest.state === 'removed' ? new Date() : null,
  }

  return db.driveMirror.upsert({
    where: { sourceDriveId_sourceItemId: { sourceDriveId, sourceItemId } },
    create: { sourceDriveId, sourceItemId, ...common },
    update: { ...common, attempts: { increment: rest.state === 'failed' ? 1 : 0 } },
  })
}

/** A deleted folder takes its copies with it, so every mirror beneath it stops claiming synced. */
export function markMirrorsRemovedUnder(sourceDriveId: string, sourcePath: string) {
  return db.driveMirror.updateMany({
    where: {
      sourceDriveId,
      sourcePath: { startsWith: `${sourcePath}/` },
      state: { not: 'removed' },
    },
    data: { state: 'removed', removedAt: new Date(), targetItemId: null },
  })
}

export function markMirrorRemoved(id: string) {
  return db.driveMirror.update({
    where: { id },
    data: { state: 'removed', removedAt: new Date(), targetItemId: null },
  })
}

export function clientForAccess(organizationId: string, clientId: string) {
  return db.client.findFirst({
    where: { id: clientId, organizationId, archivedAt: null },
    select: { id: true, name: true },
  })
}

export function groupFor(organizationId: string, groupId: string) {
  return db.clientDriveGroup.findFirst({
    where: { id: groupId, organizationId, archivedAt: null },
  })
}

export function groupNamed(organizationId: string, name: string) {
  return db.clientDriveGroup.findFirst({
    where: { organizationId, archivedAt: null, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  })
}

export function saveGroup(input: {
  organizationId: string
  name: string
  driveId: string
  itemId: string
  webUrl: string | undefined
}) {
  return db.clientDriveGroup.create({ data: { ...input, webUrl: input.webUrl ?? null } })
}

export function archiveGroup(groupId: string) {
  return db.clientDriveGroup.update({ where: { id: groupId }, data: { archivedAt: new Date() } })
}

export function groupMemberCount(groupId: string) {
  return db.clientDriveFolder.count({ where: { groupId } })
}

/** Every live group with its companies, and every company that could join one. */
export async function clientGroups(organizationId: string) {
  const [groups, clients] = await Promise.all([
    db.clientDriveGroup.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { name: 'asc' },
    }),
    db.client.findMany({
      where: { organizationId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const groupIds = groups.map((group) => group.id)
  const [folders, grants] = await Promise.all([
    db.clientDriveFolder.findMany({
      where: { clientId: { in: clients.map((client) => client.id) }, groupId: { not: null } },
      select: { clientId: true, groupId: true },
    }),
    db.clientDriveGuest.groupBy({
      by: ['groupId'],
      where: { groupId: { in: groupIds }, revokedAt: null },
      _count: { _all: true },
    }),
  ])

  const groupOfClient = new Map(folders.map((folder) => [folder.clientId, folder.groupId]))
  const grantsOf = new Map(grants.map((grant) => [grant.groupId, grant._count._all]))

  return {
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      webUrl: group.webUrl ?? undefined,
      activeGrants: grantsOf.get(group.id) ?? 0,
      members: clients
        .filter((client) => groupOfClient.get(client.id) === group.id)
        .map((client) => ({ id: client.id, name: client.name })),
    })),
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      groupId: groupOfClient.get(client.id) ?? undefined,
    })),
  }
}

export function groupGuestFor(groupId: string, email: string) {
  return db.clientDriveGuest.findUnique({ where: { groupId_email: { groupId, email } } })
}

export function groupGuestsFor(groupId: string) {
  return db.clientDriveGuest.findMany({ where: { groupId }, orderBy: { invitedAt: 'desc' } })
}

export function saveGroupGuest(input: {
  groupId: string
  email: string
  invitedUserId: string | undefined
  permissionId: string | undefined
  role: string
}) {
  const { groupId, email, ...rest } = input
  const data = {
    invitedUserId: rest.invitedUserId ?? null,
    permissionId: rest.permissionId ?? null,
    role: rest.role,
  }
  return db.clientDriveGuest.upsert({
    where: { groupId_email: { groupId, email } },
    create: { groupId, email, ...data },
    update: { ...data, revokedAt: null, invitedAt: new Date() },
  })
}

export function guestFor(clientId: string, email: string) {
  return db.clientDriveGuest.findUnique({ where: { clientId_email: { clientId, email } } })
}

export function guestsFor(clientId: string) {
  return db.clientDriveGuest.findMany({ where: { clientId }, orderBy: { invitedAt: 'desc' } })
}

export function guestById(id: string) {
  return db.clientDriveGuest.findUnique({ where: { id } })
}

export function saveGuest(input: {
  clientId: string
  email: string
  invitedUserId: string | undefined
  permissionId: string | undefined
  role: string
}) {
  const { clientId, email, ...rest } = input
  const data = {
    invitedUserId: rest.invitedUserId ?? null,
    permissionId: rest.permissionId ?? null,
    role: rest.role,
  }
  return db.clientDriveGuest.upsert({
    where: { clientId_email: { clientId, email } },
    create: { clientId, email, ...data },
    // Re-sharing a revoked guest is a new grant, so the revocation is cleared.
    update: { ...data, revokedAt: null, invitedAt: new Date() },
  })
}

export function markGuestRevoked(id: string) {
  return db.clientDriveGuest.update({
    where: { id },
    data: { revokedAt: new Date(), permissionId: null },
  })
}

export async function organizationName(organizationId: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  return organization?.name ?? 'IHP+'
}

/**
 * Guests are keyed by client or by group, not by organization, so the organization's clients and
 * groups are what scope the list — and what a search by name resolves against.
 */
export async function organizationAccess(organizationId: string, query: OrganizationAccessQuery) {
  const [clients, groups] = await Promise.all([
    db.client.findMany({ where: { organizationId }, select: { id: true, name: true } }),
    // Archived groups included, so a revoked grant on a deleted group still reads as history.
    db.clientDriveGroup.findMany({
      where: { organizationId },
      select: { id: true, name: true, webUrl: true },
    }),
  ])
  if (clients.length === 0 && groups.length === 0) {
    return { rows: [], pageInfo: pageInfoOf({ ...query, total: 0 }) }
  }

  const byId = new Map(clients.map((client) => [client.id, client.name]))
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const search = query.search.toLowerCase()
  const matching = (rows: { id: string; name: string }[]) =>
    rows.filter((row) => row.name.toLowerCase().includes(search)).map((row) => row.id)

  const and: Prisma.ClientDriveGuestWhereInput[] = [
    {
      OR: [
        { clientId: { in: clients.map((client) => client.id) } },
        { groupId: { in: groups.map((group) => group.id) } },
      ],
    },
  ]
  if (query.view === 'active') and.push({ revokedAt: null })
  if (query.view === 'removed') and.push({ revokedAt: { not: null } })
  if (search) {
    and.push({
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { clientId: { in: matching(clients) } },
        { groupId: { in: matching(groups) } },
      ],
    })
  }
  const where: Prisma.ClientDriveGuestWhereInput = { AND: and }

  const total = await db.clientDriveGuest.count({ where })
  // Paged off the clamped page, so a stale ?page= past the end still reads rows.
  const pageInfo = pageInfoOf({ ...query, total })
  const guests = await db.clientDriveGuest.findMany({
    where,
    orderBy: { [query.sortBy]: query.sortDirection },
    ...skipTake(pageInfo),
  })

  const clientIds = guests.flatMap((guest) => (guest.clientId ? [guest.clientId] : []))
  const folders = await db.clientDriveFolder.findMany({
    where: { clientId: { in: clientIds } },
    select: { clientId: true, webUrl: true },
  })
  const folderByClient = new Map(folders.map((folder) => [folder.clientId, folder.webUrl]))

  return {
    pageInfo,
    rows: guests.map((guest) => {
      const group = guest.groupId ? groupById.get(guest.groupId) : undefined
      const clientId = guest.clientId ?? ''
      return {
        id: guest.id,
        email: guest.email,
        role: guest.role,
        clientId: guest.clientId ?? undefined,
        groupId: guest.groupId ?? undefined,
        clientName: guest.groupId
          ? (group?.name ?? 'Deleted group')
          : (byId.get(clientId) ?? 'Unknown client'),
        folderUrl: guest.groupId
          ? (group?.webUrl ?? undefined)
          : (folderByClient.get(clientId) ?? undefined),
        invitedAt: guest.invitedAt.toISOString(),
        revokedAt: guest.revokedAt?.toISOString(),
      }
    }),
  }
}
