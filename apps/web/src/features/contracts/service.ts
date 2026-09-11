import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { pageInfoOf, skipTake, type SortDirection } from '@/lib/pagination'
import {
  catalogItemSchema,
  contractDraftSchema,
  contractStatusSchema,
  subtotalOf,
  type BillingCycle,
  type CatalogCategory,
  type CatalogItemRow,
  type CatalogUnit,
  type ContractDetail,
  type ContractDraftValues,
  type ContractQuery,
  type ContractRow,
  type ContractSortKey,
  type ContractStatus,
  type ContractsPage,
} from './schema'

// Contracts are company money, so reading them is open to every onboarded member the way
// clients are, but writing one is a manager's job.
async function caller() {
  const { user, profile } = await requireOnboarded()
  const membership = membershipOf(profile)

  if (!membership.organizationId) {
    throw new ConnectError(
      'Your account is not part of an organization yet.',
      Code.FailedPrecondition,
    )
  }

  return {
    userId: user.id,
    organizationId: membership.organizationId,
    canManage: canManageOrganization(membership),
  }
}

async function requireManager() {
  const context = await caller()
  if (!context.canManage) {
    throw new ConnectError('You do not have permission to manage contracts.', Code.PermissionDenied)
  }
  return context
}

// ---- Catalog ----

const CATALOG_SELECT = {
  id: true,
  category: true,
  name: true,
  description: true,
  priceMinCents: true,
  priceMaxCents: true,
  unit: true,
  percentOfSpend: true,
} satisfies Prisma.CatalogItemSelect

function catalogRowOf(row: Prisma.CatalogItemGetPayload<{ select: typeof CATALOG_SELECT }>) {
  return {
    id: row.id,
    category: row.category as CatalogCategory,
    name: row.name,
    description: row.description ?? undefined,
    priceMinCents: row.priceMinCents,
    priceMaxCents: row.priceMaxCents,
    unit: row.unit as CatalogUnit,
    percentOfSpend: row.percentOfSpend ?? undefined,
  } satisfies CatalogItemRow
}

export async function loadCatalog(): Promise<CatalogItemRow[]> {
  const { organizationId } = await caller()

  const rows = await db.catalogItem.findMany({
    where: { organizationId, archivedAt: null },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: CATALOG_SELECT,
  })

  return rows.map(catalogRowOf)
}

export async function createCatalogItem(input: unknown): Promise<CatalogItemRow> {
  const { organizationId } = await requireManager()
  const parsed = catalogItemSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError(
      parsed.error.issues[0]?.message ?? 'Check the highlighted fields.',
      Code.InvalidArgument,
    )
  }

  const values = parsed.data
  const existing = await db.catalogItem.findFirst({
    where: { organizationId, category: values.category, name: values.name },
    select: { id: true },
  })
  if (existing) {
    throw new ConnectError('That service is already on the rate card.', Code.AlreadyExists)
  }

  const created = await db.catalogItem.create({
    data: {
      organizationId,
      category: values.category,
      name: values.name,
      description: values.description || null,
      priceMinCents: values.priceMinCents,
      priceMaxCents: values.priceMaxCents,
      unit: values.unit,
      percentOfSpend: values.percentOfSpend ?? null,
    },
    select: CATALOG_SELECT,
  })

  return catalogRowOf(created)
}

// ---- Contracts ----

const CONTRACT_SELECT = {
  id: true,
  reference: true,
  title: true,
  clientId: true,
  status: true,
  billingCycle: true,
  subtotalCents: true,
  startDate: true,
  endDate: true,
  signedAt: true,
  createdAt: true,
  stripeSubscriptionId: true,
  stripeCustomerId: true,
} satisfies Prisma.ContractSelect

type ContractRecord = Prisma.ContractGetPayload<{ select: typeof CONTRACT_SELECT }>

function isoDate(value: Date | null) {
  return value ? value.toISOString() : undefined
}

function contractRowOf(row: ContractRecord, clientName: string): ContractRow {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    clientId: row.clientId,
    clientName,
    status: row.status as ContractStatus,
    billingCycle: row.billingCycle as BillingCycle,
    subtotalCents: row.subtotalCents,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    signedAt: isoDate(row.signedAt),
    createdAt: row.createdAt.toISOString(),
    isBilled: Boolean(row.stripeSubscriptionId ?? row.stripeCustomerId),
  }
}

/** One lookup for the whole page rather than a join per row; a client name is all we need. */
async function clientNames(clientIds: readonly string[]) {
  const clients = await db.client.findMany({
    where: { id: { in: [...new Set(clientIds)] } },
    select: { id: true, name: true },
  })
  return new Map(clients.map((client) => [client.id, client.name]))
}

const ORDER_BY: Record<
  ContractSortKey,
  (direction: SortDirection) => Prisma.ContractOrderByWithRelationInput
> = {
  reference: (direction) => ({ reference: direction }),
  title: (direction) => ({ title: direction }),
  status: (direction) => ({ status: direction }),
  subtotal: (direction) => ({ subtotalCents: direction }),
  createdAt: (direction) => ({ createdAt: direction }),
}

export async function loadContractsPage(query: ContractQuery): Promise<ContractsPage> {
  const { organizationId } = await caller()

  const where: Prisma.ContractWhereInput = {
    organizationId,
    archivedAt: null,
    ...(query.status === 'all' ? {} : { status: query.status }),
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.search
      ? {
          OR: [
            { reference: { contains: query.search, mode: 'insensitive' } },
            { title: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const total = await db.contract.count({ where })
  // Counted first so a stale page past the end lands on the last page, not a blank table.
  const pageInfo = pageInfoOf({ page: query.page, pageSize: query.pageSize, total })

  const rows = await db.contract.findMany({
    where,
    // The second key is the tiebreaker: without it equal values reshuffle between pages.
    orderBy: [ORDER_BY[query.sortBy](query.sortDirection), { id: 'asc' }],
    ...skipTake(pageInfo),
    select: CONTRACT_SELECT,
  })

  const names = await clientNames(rows.map((row) => row.clientId))

  return {
    pageInfo,
    rows: rows.map((row) => contractRowOf(row, names.get(row.clientId) ?? 'Removed client')),
  }
}

export async function loadContract(contractId: string): Promise<ContractDetail> {
  const { organizationId } = await caller()

  const contract = await db.contract.findFirst({
    where: { id: contractId, organizationId },
    select: {
      ...CONTRACT_SELECT,
      terms: true,
      lines: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          catalogItemId: true,
          name: true,
          description: true,
          unitPriceCents: true,
          quantity: true,
          unit: true,
        },
      },
    },
  })
  if (!contract) throw new ConnectError('That contract no longer exists.', Code.NotFound)

  const names = await clientNames([contract.clientId])

  return {
    ...contractRowOf(contract, names.get(contract.clientId) ?? 'Removed client'),
    terms: contract.terms ?? undefined,
    lines: contract.lines.map((line) => ({
      id: line.id,
      catalogItemId: line.catalogItemId ?? undefined,
      name: line.name,
      description: line.description ?? undefined,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      unit: line.unit as CatalogUnit,
    })),
  }
}

/**
 * IHP-C-0001 upward, per organization. Derived from the highest existing reference rather than
 * a count, so deleting a contract cannot hand its number to the next one.
 */
async function nextReference(organizationId: string) {
  const latest = await db.contract.findFirst({
    where: { organizationId },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  })

  const previous = Number.parseInt(latest?.reference.split('-').at(-1) ?? '0', 10)
  const next = Number.isNaN(previous) ? 1 : previous + 1
  return `IHP-C-${String(next).padStart(4, '0')}`
}

function parseDraft(input: unknown): ContractDraftValues {
  const parsed = contractDraftSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError(
      parsed.error.issues[0]?.message ?? 'Check the highlighted fields.',
      Code.InvalidArgument,
    )
  }
  return parsed.data
}

function dateOrNull(value: string) {
  return value === '' ? null : new Date(`${value}T00:00:00.000Z`)
}

export async function createContract(input: unknown): Promise<ContractDetail> {
  const { organizationId, userId } = await requireManager()
  const values = parseDraft(input)

  const client = await db.client.findFirst({
    where: { id: values.clientId, organizationId },
    select: { id: true },
  })
  if (!client) throw new ConnectError('That client no longer exists.', Code.NotFound)

  const contract = await db.contract.create({
    data: {
      organizationId,
      clientId: values.clientId,
      ownerId: userId,
      createdById: userId,
      reference: await nextReference(organizationId),
      title: values.title,
      billingCycle: values.billingCycle,
      // Cached rather than aggregated on read, so a list of contracts is one query.
      subtotalCents: subtotalOf(values.lines),
      startDate: dateOrNull(values.startDate),
      endDate: dateOrNull(values.endDate),
      terms: values.terms || null,
      lines: {
        create: values.lines.map((line, index) => ({
          catalogItemId: line.catalogItemId || null,
          name: line.name,
          description: line.description || null,
          unitPriceCents: line.unitPriceCents,
          quantity: line.quantity,
          unit: line.unit,
          sortOrder: index,
        })),
      },
    },
    select: { id: true },
  })

  return loadContract(contract.id)
}

export async function setContractStatus(input: unknown): Promise<ContractDetail> {
  const { organizationId } = await requireManager()
  const parsed = contractStatusSchema.safeParse(input)
  if (!parsed.success) throw new ConnectError('That status is not valid.', Code.InvalidArgument)

  const contract = await db.contract.findFirst({
    where: { id: parsed.data.contractId, organizationId },
    select: { id: true, signedAt: true },
  })
  if (!contract) throw new ConnectError('That contract no longer exists.', Code.NotFound)

  await db.contract.update({
    where: { id: contract.id },
    data: {
      status: parsed.data.status,
      // Going active is what agreement means, and the timestamp is what billing will key on.
      // Set once: a contract that is paused and resumed keeps the date it was first agreed.
      signedAt:
        parsed.data.status === 'active' && !contract.signedAt ? new Date() : contract.signedAt,
    },
  })

  return loadContract(contract.id)
}
