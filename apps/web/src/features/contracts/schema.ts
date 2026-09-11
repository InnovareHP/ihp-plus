import { z } from 'zod'
import { paginationSchema, sortDirectionSchema, type PageInfo } from '@/lib/pagination'

export const CATALOG_CATEGORIES = ['creative', 'social', 'bundle', 'addon'] as const

export const CATALOG_CATEGORY_LABELS: Record<CatalogCategory, string> = {
  creative: 'Creative services',
  social: 'Social media services',
  bundle: 'Bundles',
  addon: 'Add-ons',
}

/** What a price buys, shown after the amount as "$2,500/month". */
export const CATALOG_UNITS = ['project', 'month', 'campaign', 'deck', 'video', 'once'] as const

export const CATALOG_UNIT_LABELS: Record<CatalogUnit, string> = {
  project: 'project',
  month: 'month',
  campaign: 'campaign',
  deck: 'deck',
  video: 'video',
  once: 'one-off',
}

export const CONTRACT_STATUSES = [
  'draft',
  'sent',
  'active',
  'paused',
  'cancelled',
  'completed',
] as const

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  active: 'green',
  paused: 'yellow',
  cancelled: 'red',
  completed: 'teal',
}

export const BILLING_CYCLES = ['monthly', 'project'] as const

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  project: 'One-off',
}

export const CONTRACT_SORT_KEYS = ['reference', 'title', 'status', 'subtotal', 'createdAt'] as const

// Cents in, cents out: a price crosses the wire and the database as a whole number, and is
// only ever formatted for display. Not coerced — both the form and the proto hand over a
// number already, and coercion would type the resolver's input as unknown.
const cents = z.number().int().min(0).max(100_000_000)

export const contractLineSchema = z.object({
  catalogItemId: z.string().optional(),
  name: z.string().trim().min(1, 'Name this line'),
  description: z.string().trim().max(500).default(''),
  unitPriceCents: cents,
  quantity: z.number().int().min(1, 'At least one').max(999),
  unit: z.enum(CATALOG_UNITS),
})

export const contractDraftSchema = z.object({
  clientId: z.string().min(1, 'Choose a client'),
  title: z.string().trim().min(1, 'Give the contract a title').max(160),
  billingCycle: z.enum(BILLING_CYCLES),
  startDate: z.string().trim().default(''),
  endDate: z.string().trim().default(''),
  terms: z.string().trim().max(8_000).default(''),
  lines: z.array(contractLineSchema).min(1, 'A contract needs at least one service'),
})

export const contractStatusSchema = z.object({
  contractId: z.string().min(1),
  status: z.enum(CONTRACT_STATUSES),
})

export const catalogItemSchema = z
  .object({
    category: z.enum(CATALOG_CATEGORIES),
    name: z.string().trim().min(1, 'Name the service').max(120),
    description: z.string().trim().max(600).default(''),
    priceMinCents: cents,
    priceMaxCents: cents,
    unit: z.enum(CATALOG_UNITS),
    percentOfSpend: z.number().int().min(0).max(100).optional(),
  })
  // A range that runs backwards would price every contract wrongly and read as a typo.
  .refine((values) => values.priceMaxCents >= values.priceMinCents, {
    message: 'The top of the range cannot be below the bottom',
    path: ['priceMaxCents'],
  })

export const contractQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).catch('').default(''),
  status: z.enum(['all', ...CONTRACT_STATUSES]).catch('all'),
  clientId: z.string().trim().catch('').default(''),
  sortBy: z.enum(CONTRACT_SORT_KEYS).catch('createdAt'),
  sortDirection: sortDirectionSchema.catch('desc'),
})

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number]
export type CatalogUnit = (typeof CATALOG_UNITS)[number]
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]
export type BillingCycle = (typeof BILLING_CYCLES)[number]
export type ContractSortKey = (typeof CONTRACT_SORT_KEYS)[number]
export type ContractLineValues = z.infer<typeof contractLineSchema>
export type ContractDraftValues = z.infer<typeof contractDraftSchema>
/** What the form holds before zod applies its defaults; the resolver produces the type above. */
export type ContractDraftInput = z.input<typeof contractDraftSchema>
export type CatalogItemValues = z.infer<typeof catalogItemSchema>
export type ContractQuery = z.infer<typeof contractQuerySchema>

export const DEFAULT_CONTRACT_QUERY: ContractQuery = contractQuerySchema.parse({})

export interface CatalogItemRow {
  id: string
  category: CatalogCategory
  name: string
  description: string | undefined
  priceMinCents: number
  priceMaxCents: number
  unit: CatalogUnit
  percentOfSpend: number | undefined
}

export interface ContractLineRow {
  id: string
  catalogItemId: string | undefined
  name: string
  description: string | undefined
  unitPriceCents: number
  quantity: number
  unit: CatalogUnit
}

export interface ContractRow {
  id: string
  reference: string
  title: string
  clientId: string
  clientName: string
  status: ContractStatus
  billingCycle: BillingCycle
  subtotalCents: number
  /** ISO dates; a Date would cross the wire as a less predictable value. */
  startDate: string | undefined
  endDate: string | undefined
  signedAt: string | undefined
  createdAt: string
  /** True once Stripe holds a subscription or customer for it. */
  isBilled: boolean
}

export interface ContractDetail extends ContractRow {
  terms: string | undefined
  lines: ContractLineRow[]
}

export interface ContractsPage {
  rows: ContractRow[]
  pageInfo: PageInfo
}

/** Whether the query narrows the list, which decides the empty state from the no-results one. */
export function isFilteredContractQuery(query: ContractQuery) {
  return query.search !== '' || query.status !== 'all' || query.clientId !== ''
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatCents(value: number) {
  return currency.format(value / 100)
}

/** "$3,000–$7,000/project", or a single price where the range has no width. */
export function formatPriceRange(
  item: Pick<CatalogItemRow, 'priceMinCents' | 'priceMaxCents' | 'unit'>,
) {
  const unit = CATALOG_UNIT_LABELS[item.unit]
  return item.priceMinCents === item.priceMaxCents
    ? `${formatCents(item.priceMinCents)}/${unit}`
    : `${formatCents(item.priceMinCents)}–${formatCents(item.priceMaxCents)}/${unit}`
}

export function lineTotalCents(line: Pick<ContractLineRow, 'unitPriceCents' | 'quantity'>) {
  return line.unitPriceCents * line.quantity
}

export function subtotalOf(lines: readonly Pick<ContractLineRow, 'unitPriceCents' | 'quantity'>[]) {
  return lines.reduce((total, line) => total + lineTotalCents(line), 0)
}
