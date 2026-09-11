'use server'

import { db } from '@ihp/db'
import type { Client, Prisma } from '@ihp/db'
import { addOptions, listManyFor, retireOption } from '@/features/lookups/service'
import { membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { pageInfoOf, skipTake, type SortDirection } from '@/lib/pagination'
import {
  addClientOptionsSchema,
  CLIENT_LOOKUP_KINDS,
  clientIdSchema,
  clientQuerySchema,
  createClientSchema,
  emptyOptionMap,
  retireClientOptionSchema,
  updateClientSchema,
  type ClientDraftValues,
  type ClientFilterOptions,
  type ClientOptionMap,
  type ClientQuery,
  type ClientRow,
  type ClientSortKey,
  type ClientStatus,
  type ClientsPage,
} from './schema'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }
export type ClientsResult = ({ ok: true } & ClientsPage) | { ok: false; message: string }

const NO_ORGANIZATION = 'Your account is not part of an organization yet.'
const INVALID = 'Check the highlighted fields and try again.'
const GONE = 'That client no longer exists.'

// Clients belong to the organization, so every onboarded member reads and edits them; the
// organization roles gate the company screens, not this one.
async function requireOrganization() {
  const { user, profile } = await requireOnboarded()
  return { userId: user.id, organizationId: membershipOf(profile).organizationId }
}

const SEARCH_FIELDS = ['name', 'contactName', 'email', 'phone', 'city'] as const

function whereOf(organizationId: string, query: ClientQuery): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput = {
    organizationId,
    archivedAt: query.view === 'archived' ? { not: null } : null,
  }
  const clauses: Prisma.ClientWhereInput[] = []

  if (query.search) {
    clauses.push({
      OR: SEARCH_FIELDS.map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      })),
    })
  }

  if (query.statuses.length > 0) clauses.push({ status: { in: [...query.statuses] } })
  if (query.types.length > 0) clauses.push({ type: { in: query.types } })
  if (query.serviceLines.length > 0) clauses.push({ serviceLine: { in: query.serviceLines } })
  if (query.sources.length > 0) clauses.push({ source: { in: query.sources } })
  if (query.states.length > 0) clauses.push({ state: { in: query.states } })
  // hasSome, not hasEvery: picking two tags asks for clients carrying either.
  if (query.tags.length > 0) clauses.push({ tags: { hasSome: query.tags } })

  if (query.ownerIds.length > 0) {
    // 'unassigned' is a filter value, not an id, so it maps to a null owner.
    const ids = query.ownerIds.filter((id) => id !== 'unassigned')
    const owners: Prisma.ClientWhereInput[] = ids.length > 0 ? [{ ownerId: { in: ids } }] : []
    if (query.ownerIds.includes('unassigned')) owners.push({ ownerId: null })
    clauses.push({ OR: owners })
  }

  return clauses.length > 0 ? { ...where, AND: clauses } : where
}

const ORDER_BY: Record<
  ClientSortKey,
  (direction: SortDirection) => Prisma.ClientOrderByWithRelationInput
> = {
  name: (direction) => ({ name: direction }),
  status: (direction) => ({ status: direction }),
  type: (direction) => ({ type: direction }),
  city: (direction) => ({ city: direction }),
  lastContactAt: (direction) => ({ lastContactAt: direction }),
  createdAt: (direction) => ({ createdAt: direction }),
  updatedAt: (direction) => ({ updatedAt: direction }),
}

function rowOf(client: Client, ownerName: string): ClientRow {
  return {
    id: client.id,
    name: client.name,
    contactName: client.contactName ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    status: client.status as ClientStatus,
    type: client.type ?? '',
    serviceLine: client.serviceLine ?? '',
    source: client.source ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    tags: client.tags,
    notes: client.notes ?? '',
    ownerId: client.ownerId ?? '',
    ownerName,
    lastContactAt: client.lastContactAt?.toISOString(),
    createdAt: client.createdAt.toISOString(),
    archivedAt: client.archivedAt?.toISOString(),
  }
}

/** One lookup for the whole page, so the table never renders a raw user id. */
async function ownerNames(clients: readonly Client[]) {
  const ids = [...new Set(clients.map((client) => client.ownerId).filter(Boolean))] as string[]
  if (ids.length === 0) return new Map<string, string>()

  const owners = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })
  return new Map(owners.map((owner) => [owner.id, owner.name]))
}

// Blank means "not given" everywhere in the form, and the column stores null for it.
function nullable(value: string) {
  return value.trim() === '' ? null : value.trim()
}

function dataOf(values: ClientDraftValues) {
  return {
    name: values.name.trim(),
    contactName: nullable(values.contactName),
    email: nullable(values.email),
    phone: nullable(values.phone),
    status: values.status,
    type: nullable(values.type),
    serviceLine: nullable(values.serviceLine),
    source: nullable(values.source),
    city: nullable(values.city),
    state: nullable(values.state),
    tags: values.tags.map((tag) => tag.trim()).filter(Boolean),
    ownerId: nullable(values.ownerId),
    notes: nullable(values.notes),
    lastContactAt: values.lastContactAt ? new Date(`${values.lastContactAt}T00:00:00.000Z`) : null,
  }
}

export async function listClients(input?: unknown): Promise<ClientsResult> {
  const { organizationId } = await requireOrganization()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }

  const query = clientQuerySchema.parse(input ?? {})
  const where = whereOf(organizationId, query)

  const total = await db.client.count({ where })
  // Counted first so a stale ?page= past the end lands on the last page instead of a blank table.
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })

  const clients = await db.client.findMany({
    where,
    // The second key is the tiebreaker: without it equal values reshuffle between pages.
    orderBy: [ORDER_BY[query.sortBy](query.sortDirection), { id: 'asc' }],
    ...skipTake(pageInfo),
  })

  const names = await ownerNames(clients)

  return {
    ok: true,
    pageInfo,
    rows: clients.map((client) => rowOf(client, names.get(client.ownerId ?? '') ?? '')),
  }
}

/** The owners and the curated dropdown values every filter and form field reads. */
export async function listClientFilterOptions(): Promise<Result<ClientFilterOptions>> {
  const { organizationId } = await requireOrganization()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }

  const [members, lookups] = await Promise.all([
    db.member.findMany({
      where: { organizationId },
      orderBy: { user: { name: 'asc' } },
      select: { user: { select: { id: true, name: true } } },
    }),
    listManyFor(organizationId, CLIENT_LOOKUP_KINDS),
  ])

  const options: ClientOptionMap = emptyOptionMap()
  for (const kind of CLIENT_LOOKUP_KINDS) options[kind] = lookups.get(kind) ?? []

  return { ok: true, data: { owners: members.map((member) => member.user), options } }
}

/** Bulk insert of dropdown values; the lookups service owns the option table. */
export async function addClientOptions(
  input: unknown,
): Promise<Result<{ added: number; skipped: number }>> {
  const { organizationId } = await requireOrganization()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = addClientOptionsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Paste at least one value to add.' }

  const counts = await addOptions(organizationId, parsed.data.kind, parsed.data.values)
  return { ok: true, data: counts }
}

/** Retiring an option keeps the clients already carrying its value readable. */
export async function archiveClientOption(input: unknown): Promise<Result<null>> {
  const { organizationId } = await requireOrganization()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = retireClientOptionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const retired = await retireOption(organizationId, parsed.data.kind, parsed.data.value)
  if (!retired) return { ok: false, message: 'That option is already retired.' }

  return { ok: true, data: null }
}

export async function createClient(input: unknown): Promise<Result<ClientRow>> {
  const { organizationId, userId } = await requireOrganization()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = createClientSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const client = await db.client.create({
    data: { ...dataOf(parsed.data), organizationId, createdById: userId },
  })

  const names = await ownerNames([client])
  return { ok: true, data: rowOf(client, names.get(client.ownerId ?? '') ?? '') }
}

export async function updateClient(input: unknown): Promise<Result<ClientRow>> {
  const { organizationId } = await requireOrganization()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = updateClientSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  // updateMany, not update: the organization id has to be part of the match, never trusted input.
  const { id, ...values } = parsed.data
  const changed = await db.client.updateMany({
    where: { id, organizationId },
    data: dataOf(values),
  })
  if (changed.count === 0) return { ok: false, message: GONE }

  const client = await db.client.findUnique({ where: { id } })
  if (!client) return { ok: false, message: GONE }

  const names = await ownerNames([client])
  return { ok: true, data: rowOf(client, names.get(client.ownerId ?? '') ?? '') }
}

export async function archiveClient(input: unknown): Promise<Result<null>> {
  return setArchived(input, new Date())
}

export async function restoreClient(input: unknown): Promise<Result<null>> {
  return setArchived(input, null)
}

async function setArchived(input: unknown, archivedAt: Date | null): Promise<Result<null>> {
  const { organizationId } = await requireOrganization()
  if (!organizationId) return { ok: false, message: NO_ORGANIZATION }

  const parsed = clientIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: INVALID }

  const changed = await db.client.updateMany({
    where: { id: parsed.data.id, organizationId },
    data: { archivedAt },
  })
  if (changed.count === 0) return { ok: false, message: GONE }

  return { ok: true, data: null }
}
