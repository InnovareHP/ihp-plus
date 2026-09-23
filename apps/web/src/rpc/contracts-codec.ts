import {
  BillingCycle,
  CatalogUnit,
  ContractSortKey,
  ContractStatus,
  SortDirection,
  type CatalogItem,
  type Contract,
  type ContractDetail as ContractDetailMessage,
  type ContractInvoice as ContractInvoiceMessage,
  type ContractLine,
  type ContractQuery as ContractQueryMessage,
} from '@ihp/rpc/contracts'
import { DEFAULT_CONTRACT_QUERY } from '@/features/contracts/schema'
import type {
  BillingCycle as Cycle,
  CatalogItemRow,
  CatalogUnit as Unit,
  ContractDetail,
  ContractInvoiceRow,
  ContractLineRow,
  ContractQuery,
  ContractRow,
  ContractSortKey as SortKey,
  ContractStatus as Status,
} from '@/features/contracts/schema'
import type { SortDirection as Direction } from '@/lib/pagination'

// The UI keeps its string unions and the wire keeps its enums. Every crossing goes through
// these maps, so an UNSPECIFIED from an older client falls back instead of throwing.
const UNIT_TO: Record<Unit, CatalogUnit> = {
  project: CatalogUnit.PROJECT,
  month: CatalogUnit.MONTH,
  campaign: CatalogUnit.CAMPAIGN,
  deck: CatalogUnit.DECK,
  video: CatalogUnit.VIDEO,
  once: CatalogUnit.ONCE,
}

const UNIT_FROM: Record<CatalogUnit, Unit> = {
  [CatalogUnit.UNSPECIFIED]: 'project',
  [CatalogUnit.PROJECT]: 'project',
  [CatalogUnit.MONTH]: 'month',
  [CatalogUnit.CAMPAIGN]: 'campaign',
  [CatalogUnit.DECK]: 'deck',
  [CatalogUnit.VIDEO]: 'video',
  [CatalogUnit.ONCE]: 'once',
}

const STATUS_TO: Record<Status, ContractStatus> = {
  draft: ContractStatus.DRAFT,
  sent: ContractStatus.SENT,
  active: ContractStatus.ACTIVE,
  paused: ContractStatus.PAUSED,
  cancelled: ContractStatus.CANCELLED,
  completed: ContractStatus.COMPLETED,
}

const STATUS_FROM: Record<ContractStatus, Status> = {
  [ContractStatus.UNSPECIFIED]: 'draft',
  [ContractStatus.DRAFT]: 'draft',
  [ContractStatus.SENT]: 'sent',
  [ContractStatus.ACTIVE]: 'active',
  [ContractStatus.PAUSED]: 'paused',
  [ContractStatus.CANCELLED]: 'cancelled',
  [ContractStatus.COMPLETED]: 'completed',
}

const CYCLE_TO: Record<Cycle, BillingCycle> = {
  monthly: BillingCycle.MONTHLY,
  project: BillingCycle.PROJECT,
}

const CYCLE_FROM: Record<BillingCycle, Cycle> = {
  [BillingCycle.UNSPECIFIED]: 'monthly',
  [BillingCycle.MONTHLY]: 'monthly',
  [BillingCycle.PROJECT]: 'project',
}

const SORT_TO: Record<SortKey, ContractSortKey> = {
  reference: ContractSortKey.REFERENCE,
  title: ContractSortKey.TITLE,
  status: ContractSortKey.STATUS,
  subtotal: ContractSortKey.SUBTOTAL,
  createdAt: ContractSortKey.CREATED_AT,
}

const SORT_FROM: Record<ContractSortKey, SortKey> = {
  [ContractSortKey.UNSPECIFIED]: 'createdAt',
  [ContractSortKey.REFERENCE]: 'reference',
  [ContractSortKey.TITLE]: 'title',
  [ContractSortKey.STATUS]: 'status',
  [ContractSortKey.SUBTOTAL]: 'subtotal',
  [ContractSortKey.CREATED_AT]: 'createdAt',
}

const DIRECTION_TO: Record<Direction, SortDirection> = {
  asc: SortDirection.ASC,
  desc: SortDirection.DESC,
}

const DIRECTION_FROM: Record<SortDirection, Direction> = {
  [SortDirection.UNSPECIFIED]: 'desc',
  [SortDirection.ASC]: 'asc',
  [SortDirection.DESC]: 'desc',
}

export const unitToProto = (value: Unit) => UNIT_TO[value]
export const statusToProto = (value: Status) => STATUS_TO[value]
export const statusFromProto = (value: ContractStatus) => STATUS_FROM[value]
export const cycleToProto = (value: Cycle) => CYCLE_TO[value]
export const cycleFromProto = (value: BillingCycle) => CYCLE_FROM[value]

export function queryToProto(query: ContractQuery): ContractQueryMessage {
  return {
    $typeName: 'ihp.contracts.v1.ContractQuery',
    search: query.search,
    // 'all' is the absence of a status filter, not a status of its own.
    status: query.status === 'all' ? undefined : STATUS_TO[query.status],
    clientId: query.clientId || undefined,
    sortBy: SORT_TO[query.sortBy],
    sortDirection: DIRECTION_TO[query.sortDirection],
    page: query.page,
    pageSize: query.pageSize,
  }
}

export function queryFromProto(message: ContractQueryMessage | undefined): ContractQuery {
  if (!message) return DEFAULT_CONTRACT_QUERY

  return {
    search: message.search,
    status: message.status === undefined ? 'all' : STATUS_FROM[message.status],
    clientId: message.clientId ?? '',
    sortBy: SORT_FROM[message.sortBy],
    sortDirection: DIRECTION_FROM[message.sortDirection],
    // A zero means the field was never set, so the default stands in.
    page: message.page || DEFAULT_CONTRACT_QUERY.page,
    pageSize: message.pageSize || DEFAULT_CONTRACT_QUERY.pageSize,
  }
}

export function contractToProto(row: ContractRow): Contract {
  return {
    $typeName: 'ihp.contracts.v1.Contract',
    id: row.id,
    reference: row.reference,
    title: row.title,
    clientId: row.clientId,
    clientName: row.clientName,
    status: STATUS_TO[row.status],
    billingCycle: CYCLE_TO[row.billingCycle],
    subtotalCents: row.subtotalCents,
    startDate: row.startDate,
    endDate: row.endDate,
    signedAt: row.signedAt,
    createdAt: row.createdAt,
    isBilled: row.isBilled,
  }
}

export function contractFromProto(message: Contract): ContractRow {
  return {
    id: message.id,
    reference: message.reference,
    title: message.title,
    clientId: message.clientId,
    clientName: message.clientName,
    status: STATUS_FROM[message.status],
    billingCycle: CYCLE_FROM[message.billingCycle],
    subtotalCents: message.subtotalCents,
    startDate: message.startDate,
    endDate: message.endDate,
    signedAt: message.signedAt,
    createdAt: message.createdAt,
    isBilled: message.isBilled,
  }
}

function lineToProto(line: ContractLineRow): ContractLine {
  return {
    $typeName: 'ihp.contracts.v1.ContractLine',
    id: line.id,
    catalogItemId: line.catalogItemId,
    name: line.name,
    description: line.description,
    unitPriceCents: line.unitPriceCents,
    quantity: line.quantity,
    unit: UNIT_TO[line.unit],
  }
}

function lineFromProto(message: ContractLine): ContractLineRow {
  return {
    id: message.id,
    catalogItemId: message.catalogItemId,
    name: message.name,
    description: message.description,
    unitPriceCents: message.unitPriceCents,
    quantity: message.quantity,
    unit: UNIT_FROM[message.unit],
  }
}

export function detailToProto(detail: ContractDetail): ContractDetailMessage {
  return {
    $typeName: 'ihp.contracts.v1.ContractDetail',
    contract: contractToProto(detail),
    terms: detail.terms,
    lines: detail.lines.map(lineToProto),
    clientLink: detail.clientLink,
    viewedAt: detail.viewedAt,
    acceptedByName: detail.acceptedByName,
  }
}

export function detailFromProto(message: ContractDetailMessage | undefined): ContractDetail {
  if (!message?.contract) throw new Error('The server did not return the contract.')

  return {
    ...contractFromProto(message.contract),
    terms: message.terms,
    lines: message.lines.map(lineFromProto),
    clientLink: message.clientLink,
    viewedAt: message.viewedAt,
    acceptedByName: message.acceptedByName,
  }
}

export function invoiceToProto(invoice: ContractInvoiceRow): ContractInvoiceMessage {
  return { $typeName: 'ihp.contracts.v1.ContractInvoice', ...invoice }
}

export function invoiceFromProto(message: ContractInvoiceMessage): ContractInvoiceRow {
  return {
    id: message.id,
    status: message.status,
    amountDueCents: message.amountDueCents,
    amountPaidCents: message.amountPaidCents,
    currency: message.currency,
    hostedInvoiceUrl: message.hostedInvoiceUrl,
    paidAt: message.paidAt,
    failedAt: message.failedAt,
    failureReason: message.failureReason,
    periodStart: message.periodStart,
    periodEnd: message.periodEnd,
    createdAt: message.createdAt,
  }
}

export function catalogToProto(item: CatalogItemRow): CatalogItem {
  return {
    $typeName: 'ihp.contracts.v1.CatalogItem',
    id: item.id,
    section: item.category,
    name: item.name,
    description: item.description,
    priceMinCents: item.priceMinCents,
    priceMaxCents: item.priceMaxCents,
    unit: UNIT_TO[item.unit],
    percentOfSpend: item.percentOfSpend,
    defaultTerms: item.defaultTerms,
  }
}

export function catalogFromProto(message: CatalogItem): CatalogItemRow {
  return {
    id: message.id,
    category: message.section,
    name: message.name,
    description: message.description,
    priceMinCents: message.priceMinCents,
    priceMaxCents: message.priceMaxCents,
    unit: UNIT_FROM[message.unit],
    percentOfSpend: message.percentOfSpend,
    defaultTerms: message.defaultTerms,
  }
}

export function catalogUnitFromProto(value: CatalogUnit) {
  return UNIT_FROM[value]
}

interface ActivityEntry {
  id: string
  label: string
  actorName: string
  detail: string | undefined
  createdAt: string
}

export function activityToProto(entry: ActivityEntry) {
  return { $typeName: 'ihp.contracts.v1.ContractActivity' as const, ...entry }
}

export function activityFromProto(message: {
  id: string
  label: string
  actorName: string
  detail?: string | undefined
  createdAt: string
}): ActivityEntry {
  return {
    id: message.id,
    label: message.label,
    actorName: message.actorName,
    detail: message.detail,
    createdAt: message.createdAt,
  }
}
