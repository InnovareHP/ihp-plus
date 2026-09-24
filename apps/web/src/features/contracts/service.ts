import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { syncBilling } from '@/features/billing/contract-billing'
import { listFor } from '@/features/lookups/service'
import {
  loadActivity,
  recordActivity,
  type ActivityAction,
  type ActivityItem,
} from '@/lib/activity'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import {
  contractPublishedTemplate,
  contractStatusChangedTemplate,
  portalUrl,
  sendEmail,
} from '@/lib/email'
import { pageInfoOf, skipTake, type SortDirection } from '@/lib/pagination'
import { clientTab } from '@/lib/routes'
import { clientContractUrl } from './client-link'
import {
  catalogItemSchema,
  contractDraftSchema,
  contractStatusSchema,
  contractUpdateSchema,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TRANSITIONS,
  isEditable,
  subtotalOf,
  type BillingCycle,
  type CatalogItemRow,
  type CatalogUnit,
  type ContractDetail,
  type ContractInvoiceRow,
  type ContractDraftValues,
  type ContractQuery,
  type ContractRow,
  type ContractSortKey,
  type ContractStatus,
  type ContractsPage,
  type ContractTemplateValues,
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
    // The name history shows, snapshotted per entry so a later rename does not rewrite it.
    userName: profile.preferredName ?? user.name,
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
  defaultTerms: true,
  archivedAt: true,
} satisfies Prisma.CatalogItemSelect

function catalogRowOf(row: Prisma.CatalogItemGetPayload<{ select: typeof CATALOG_SELECT }>) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description ?? undefined,
    priceMinCents: row.priceMinCents,
    priceMaxCents: row.priceMaxCents,
    unit: row.unit as CatalogUnit,
    percentOfSpend: row.percentOfSpend ?? undefined,
    defaultTerms: row.defaultTerms ?? undefined,
    archived: row.archivedAt !== null,
  } satisfies CatalogItemRow
}

export async function loadCatalog(includeArchived = false): Promise<CatalogItemRow[]> {
  const who = includeArchived ? await requireManager() : await caller()
  const { organizationId } = who

  const rows = await db.catalogItem.findMany({
    where: { organizationId, ...(includeArchived ? {} : { archivedAt: null }) },
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
  const sections = await listFor(organizationId, 'catalogSection')
  if (!sections.some((section) => section.value === values.category)) {
    throw new ConnectError(
      'That section is not on the list any more. Choose another, or ask an admin to add it.',
      Code.InvalidArgument,
    )
  }

  const existing = await db.catalogItem.findFirst({
    where: { organizationId, category: values.category, name: values.name },
    select: { archivedAt: true },
  })
  if (existing) throw duplicateOf(existing)

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
      defaultTerms: values.defaultTerms || null,
    },
    select: CATALOG_SELECT,
  })

  return catalogRowOf(created)
}

// A retired service still owns its name, so the way out is to bring it back, not to re-add it.
function duplicateOf(existing: { archivedAt: Date | null }) {
  return new ConnectError(
    existing.archivedAt
      ? 'An archived service already has that name in this section. Restore it instead.'
      : 'That service is already on the rate card.',
    Code.AlreadyExists,
  )
}

async function catalogItemOrThrow(organizationId: string, itemId: string) {
  const item = await db.catalogItem.findFirst({
    where: { id: itemId, organizationId },
    select: { id: true, category: true },
  })
  if (!item) throw new ConnectError('That service is no longer on the rate card.', Code.NotFound)
  return item
}

/** A correction to a service; contract lines already priced from it keep what was agreed. */
export async function updateCatalogItem(itemId: string, input: unknown): Promise<CatalogItemRow> {
  const { organizationId } = await requireManager()
  const parsed = catalogItemSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError(
      parsed.error.issues[0]?.message ?? 'Check the highlighted fields.',
      Code.InvalidArgument,
    )
  }

  const values = parsed.data
  const current = await catalogItemOrThrow(organizationId, itemId)
  // A section since removed from the list may stay where it is, but nothing new moves into it.
  if (values.category !== current.category) {
    const sections = await listFor(organizationId, 'catalogSection')
    if (!sections.some((section) => section.value === values.category)) {
      throw new ConnectError(
        'That section is not on the list any more. Choose another, or ask an admin to add it.',
        Code.InvalidArgument,
      )
    }
  }

  const clash = await db.catalogItem.findFirst({
    where: {
      organizationId,
      category: values.category,
      name: values.name,
      NOT: { id: current.id },
    },
    select: { archivedAt: true },
  })
  if (clash) throw duplicateOf(clash)

  const updated = await db.catalogItem.update({
    where: { id: current.id },
    data: {
      category: values.category,
      name: values.name,
      description: values.description || null,
      priceMinCents: values.priceMinCents,
      priceMaxCents: values.priceMaxCents,
      unit: values.unit,
      percentOfSpend: values.percentOfSpend ?? null,
      defaultTerms: values.defaultTerms || null,
    },
    select: CATALOG_SELECT,
  })
  return catalogRowOf(updated)
}

/** Retires a service or brings it back; archived ones leave the card and the contract picker. */
export async function setCatalogItemArchived(
  itemId: string,
  archived: boolean,
): Promise<CatalogItemRow> {
  const { organizationId } = await requireManager()
  const current = await catalogItemOrThrow(organizationId, itemId)

  const updated = await db.catalogItem.update({
    where: { id: current.id },
    data: { archivedAt: archived ? new Date() : null },
    select: CATALOG_SELECT,
  })
  return catalogRowOf(updated)
}

// ---- Terms template ----

/**
 * The organization's boilerplate. A company that has never been seeded has no row, so empty
 * strings stand in rather than the caller having to handle a missing template.
 */
export async function loadContractTemplate(): Promise<ContractTemplateValues> {
  const { organizationId } = await caller()

  const template = await db.contractTemplate.findUnique({
    where: { organizationId },
    select: { scopeTemplate: true, standardTerms: true },
  })

  return template ?? { scopeTemplate: '', standardTerms: '' }
}

export async function updateContractTemplate(input: {
  scopeTemplate: string
  standardTerms: string
}): Promise<ContractTemplateValues> {
  const { organizationId } = await requireManager()

  const template = await db.contractTemplate.upsert({
    where: { organizationId },
    update: { scopeTemplate: input.scopeTemplate, standardTerms: input.standardTerms },
    create: {
      organizationId,
      scopeTemplate: input.scopeTemplate,
      standardTerms: input.standardTerms,
    },
    select: { scopeTemplate: true, standardTerms: true },
  })

  return template
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
      sharedAt: true,
      viewedAt: true,
      acceptedByName: true,
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
    // Only while it waits on the client: once answered, the link is a record, not an action.
    clientLink:
      contract.status === 'sent' && contract.sharedAt
        ? clientContractUrl(contract.id, contract.sharedAt)
        : undefined,
    viewedAt: isoDate(contract.viewedAt),
    acceptedByName: contract.acceptedByName ?? undefined,
  }
}

/** What Stripe billed for one contract, newest first, as the webhook recorded it. */
export async function loadContractInvoices(contractId: string): Promise<ContractInvoiceRow[]> {
  const { organizationId } = await caller()

  // Checked first: an invoice row carries no organization, so the contract is what scopes it.
  const contract = await db.contract.findFirst({
    where: { id: contractId, organizationId },
    select: { id: true },
  })
  if (!contract) throw new ConnectError('That contract no longer exists.', Code.NotFound)

  const invoices = await db.stripeInvoice.findMany({
    where: { contractId: contract.id },
    orderBy: { createdAt: 'desc' },
    take: 24,
  })

  return invoices.map((invoice) => ({
    id: invoice.id,
    status: invoice.status,
    amountDueCents: invoice.amountDueCents,
    amountPaidCents: invoice.amountPaidCents,
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hostedInvoiceUrl ?? undefined,
    paidAt: isoDate(invoice.paidAt),
    failedAt: isoDate(invoice.failedAt),
    failureReason: invoice.failureReason ?? undefined,
    periodStart: isoDate(invoice.periodStart),
    periodEnd: isoDate(invoice.periodEnd),
    createdAt: invoice.createdAt.toISOString(),
  }))
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

function statusActionOf(from: ContractStatus, to: ContractStatus): ActivityAction {
  if (to === 'sent') return 'contract.published'
  if (to === 'draft') return 'contract.returned_to_draft'
  if (to === 'active') return from === 'paused' ? 'contract.resumed' : 'contract.agreed'
  if (to === 'paused') return 'contract.paused'
  if (to === 'cancelled') return 'contract.cancelled'
  return 'contract.completed'
}

/** A contract's history, oldest first, for its drawer. */
export async function loadContractActivity(contractId: string): Promise<ActivityItem[]> {
  const { organizationId } = await caller()

  // Checked first: history rows carry no contract relation, so the contract is what scopes them.
  const contract = await db.contract.findFirst({
    where: { id: contractId, organizationId },
    select: { id: true },
  })
  if (!contract) throw new ConnectError('That contract no longer exists.', Code.NotFound)

  return loadActivity(organizationId, 'contract', contract.id)
}

export async function createContract(input: unknown): Promise<ContractDetail> {
  const { organizationId, userId, userName } = await requireManager()
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

  await recordActivity({
    organizationId,
    subjectType: 'contract',
    subjectId: contract.id,
    action: 'contract.created',
    actorId: userId,
    actorName: userName,
  })

  return loadContract(contract.id)
}

export async function updateContract(input: unknown): Promise<ContractDetail> {
  const { organizationId, userId, userName } = await requireManager()
  const parsed = contractUpdateSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError(
      parsed.error.issues[0]?.message ?? 'Check the highlighted fields.',
      Code.InvalidArgument,
    )
  }

  const values = parsed.data
  const existing = await db.contract.findFirst({
    where: { id: values.contractId, organizationId },
    select: { id: true, status: true },
  })
  if (!existing) throw new ConnectError('That contract no longer exists.', Code.NotFound)

  // Checked here rather than only in the UI: a contract a client has been shown must not be
  // re-priced behind their back, whatever the caller sends.
  if (!isEditable(existing.status as ContractStatus)) {
    throw new ConnectError(
      'Only a draft can be edited. Return it to draft first.',
      Code.FailedPrecondition,
    )
  }

  const client = await db.client.findFirst({
    where: { id: values.clientId, organizationId },
    select: { id: true },
  })
  if (!client) throw new ConnectError('That client no longer exists.', Code.NotFound)

  await db.contract.update({
    where: { id: existing.id },
    data: {
      clientId: values.clientId,
      title: values.title,
      billingCycle: values.billingCycle,
      subtotalCents: subtotalOf(values.lines),
      startDate: dateOrNull(values.startDate),
      endDate: dateOrNull(values.endDate),
      terms: values.terms || null,
      // Replaced wholesale rather than diffed: a line carries no identity of its own once the
      // contract is being re-priced, and matching them up would invent one.
      lines: {
        deleteMany: {},
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
  })

  await recordActivity({
    organizationId,
    subjectType: 'contract',
    subjectId: existing.id,
    action: 'contract.edited',
    actorId: userId,
    actorName: userName,
  })

  return loadContract(existing.id)
}

export async function setContractStatus(input: unknown): Promise<ContractDetail> {
  const { organizationId, userId, userName } = await requireManager()
  const parsed = contractStatusSchema.safeParse(input)
  if (!parsed.success) throw new ConnectError('That status is not valid.', Code.InvalidArgument)

  const contract = await db.contract.findFirst({
    where: { id: parsed.data.contractId, organizationId },
    select: {
      id: true,
      signedAt: true,
      status: true,
      clientId: true,
      reference: true,
      title: true,
      billingCycle: true,
      startDate: true,
      endDate: true,
      updatedAt: true,
      ownerId: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      lines: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
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

  const from = contract.status as ContractStatus
  if (!CONTRACT_TRANSITIONS[from].includes(parsed.data.status)) {
    throw new ConnectError(
      `A ${from} contract cannot become ${parsed.data.status}.`,
      Code.FailedPrecondition,
    )
  }

  const to = parsed.data.status
  const recipient = to === 'sent' ? await publishRecipient(contract.clientId, organizationId) : null

  // Stripe first: if it refuses, this throws and the contract is never marked as changed.
  const attachment = await syncBilling({ ...contract, organizationId }, to)
  // A fresh publication signs a fresh link, and returning to draft retires the old one.
  const sharedAt = to === 'sent' ? new Date() : to === 'draft' ? null : undefined

  await db.contract.update({
    where: { id: contract.id },
    data: {
      ...attachment,
      status: to,
      // Going active is what agreement means, and the timestamp is what billing will key on.
      // Set once: a contract that is paused and resumed keeps the date it was first agreed.
      signedAt: to === 'active' && !contract.signedAt ? new Date() : contract.signedAt,
      ...(sharedAt === undefined ? {} : { sharedAt, viewedAt: null }),
    },
  })

  await recordActivity({
    organizationId,
    subjectType: 'contract',
    subjectId: contract.id,
    action: statusActionOf(from, to),
    actorId: userId,
    actorName: userName,
  })

  // Not awaited: the status already moved, and the owner hearing about it is a courtesy.
  void notifyContractOwner(contract, to, userId, userName)

  if (recipient && sharedAt) {
    // Not awaited, and sendEmail never throws: a slow mail provider must not hold up publishing.
    void sendEmail({
      to: recipient.email,
      ...contractPublishedTemplate({
        organizationName: recipient.organizationName,
        reference: contract.reference,
        title: contract.title,
        url: clientContractUrl(contract.id, sharedAt),
      }),
    })
  }

  return loadContract(contract.id)
}

/** Tells a contract's owner when somebody else moves it, since the money is theirs to track. */
async function notifyContractOwner(
  contract: {
    id: string
    ownerId: string | null
    clientId: string
    reference: string
    title: string
  },
  status: ContractStatus,
  actorId: string,
  actorName: string,
) {
  try {
    if (!contract.ownerId || contract.ownerId === actorId) return

    const [owner, client] = await Promise.all([
      db.user.findUnique({ where: { id: contract.ownerId }, select: { email: true } }),
      db.client.findUnique({ where: { id: contract.clientId }, select: { name: true } }),
    ])
    if (!owner) return

    void sendEmail({
      to: owner.email,
      ...contractStatusChangedTemplate({
        reference: contract.reference,
        title: contract.title,
        clientName: client?.name ?? 'the client',
        statusLabel: CONTRACT_STATUS_LABELS[status].toLowerCase(),
        changedByName: actorName,
        url: portalUrl(clientTab('contracts')),
      }),
    })
  } catch (error) {
    console.error(`[contracts] could not tell the owner of ${contract.id}`, error)
  }
}

// Publishing emails the client their link, so a client with no address cannot be published to.
async function publishRecipient(clientId: string, organizationId: string) {
  const [client, organization] = await Promise.all([
    db.client.findFirst({
      where: { id: clientId, organizationId },
      select: { name: true, email: true },
    }),
    db.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
  ])
  if (!client) throw new ConnectError('That client no longer exists.', Code.NotFound)
  if (!client.email) {
    throw new ConnectError(
      `Add an email for ${client.name} before publishing. The contract link and invoices go there.`,
      Code.FailedPrecondition,
    )
  }
  return { email: client.email, organizationName: organization?.name ?? 'IHP+' }
}
