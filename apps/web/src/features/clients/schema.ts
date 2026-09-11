import { z } from 'zod'
import { OPTION_LIMITS, type LookupKind } from '@/features/lookups/schema'
import { paginationSchema, sortDirectionSchema, type PageInfo } from '@/lib/pagination'

export const CLIENT_STATUSES = ['prospect', 'active', 'on_hold', 'inactive'] as const

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: 'Prospect',
  active: 'Active',
  on_hold: 'On hold',
  inactive: 'Inactive',
}

export const CLIENT_STATUS_COLORS: Record<ClientStatus, string> = {
  prospect: 'blue',
  active: 'green',
  on_hold: 'yellow',
  inactive: 'gray',
}

/**
 * The client dropdowns are lookup kinds like any other, so they live in one option table with
 * the portal's own lists rather than a second one beside it.
 */
export const CLIENT_LOOKUP_KINDS = [
  'clientType',
  'clientServiceLine',
  'clientSource',
  'clientCity',
  'clientState',
  'clientTag',
] as const satisfies readonly LookupKind[]

/** Which lookup list fills each field on the form. */
export const CLIENT_FIELD_LOOKUPS = {
  type: 'clientType',
  serviceLine: 'clientServiceLine',
  source: 'clientSource',
  city: 'clientCity',
  state: 'clientState',
} as const satisfies Record<string, ClientLookupKind>

export const CLIENT_VIEWS = ['active', 'archived'] as const
export const CLIENT_SORT_KEYS = [
  'name',
  'status',
  'type',
  'city',
  'lastContactAt',
  'createdAt',
  'updatedAt',
] as const

/** A filter arrives as `?x=a,b` or repeated `?x=a&x=b`; an unknown value is dropped, never thrown. */
function csvOf<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) => (typeof raw === 'string' ? raw.split(',') : (raw ?? [])))
    .transform((list) =>
      list.filter((item): item is T[number] => (values as readonly string[]).includes(item)),
    )
}

const csvValues = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((raw) => (typeof raw === 'string' ? raw.split(',') : (raw ?? [])))
  // Capped so a crafted URL cannot turn one filter into a thousand-branch IN clause.
  .transform((list) =>
    list
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 50),
  )

export const clientQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).catch('').default(''),
  statuses: csvOf(CLIENT_STATUSES),
  ownerIds: csvValues,
  types: csvValues,
  serviceLines: csvValues,
  sources: csvValues,
  states: csvValues,
  tags: csvValues,
  // Archived clients are a separate view rather than a row mixed into the live list.
  view: z.enum(CLIENT_VIEWS).catch('active'),
  sortBy: z.enum(CLIENT_SORT_KEYS).catch('name'),
  sortDirection: sortDirectionSchema.catch('asc'),
})

// Blank is how the form says "not given", so every optional field accepts '' rather than
// defaulting — react-hook-form needs the schema's input and output shapes to match.
const optionalText = (max: number) => z.string().trim().max(max)

export const clientDraftSchema = z.object({
  name: z.string().trim().min(2, 'Give the client a name.').max(120),
  contactName: optionalText(120),
  email: z.union([z.email('Enter a valid email address.'), z.literal('')]),
  phone: optionalText(40),
  status: z.enum(CLIENT_STATUSES),
  type: optionalText(80),
  serviceLine: optionalText(80),
  source: optionalText(80),
  city: optionalText(80),
  state: optionalText(40),
  tags: z.array(z.string().trim().min(1).max(40)).max(20, 'Twenty tags is the limit.'),
  ownerId: z.string().max(64),
  notes: z.string().trim().max(2000, 'Keep notes under 2000 characters.'),
  lastContactAt: z.union([z.iso.date('Use the date picker.'), z.literal('')]),
})

export const createClientSchema = clientDraftSchema
export const updateClientSchema = clientDraftSchema.extend({ id: z.string().min(1) })
export const clientIdSchema = z.object({ id: z.string().min(1) })

export const addClientOptionsSchema = z.object({
  kind: z.enum(CLIENT_LOOKUP_KINDS),
  values: z
    .array(z.string().trim().min(1).max(OPTION_LIMITS.maxLength))
    .min(1)
    .max(OPTION_LIMITS.maxBulk),
})

export const retireClientOptionSchema = z.object({
  kind: z.enum(CLIENT_LOOKUP_KINDS),
  value: z.string().trim().min(1).max(OPTION_LIMITS.maxLength),
})

export type ClientStatus = (typeof CLIENT_STATUSES)[number]
export type ClientLookupKind = (typeof CLIENT_LOOKUP_KINDS)[number]
export type ClientView = (typeof CLIENT_VIEWS)[number]
export type ClientSortKey = (typeof CLIENT_SORT_KEYS)[number]
export type ClientQuery = z.infer<typeof clientQuerySchema>
export type ClientDraftValues = z.infer<typeof clientDraftSchema>
export type UpdateClientValues = z.infer<typeof updateClientSchema>
export type AddClientOptionsValues = z.infer<typeof addClientOptionsSchema>
export type RetireClientOptionValues = z.infer<typeof retireClientOptionSchema>

export const DEFAULT_CLIENT_QUERY: ClientQuery = clientQuerySchema.parse({})

export const EMPTY_CLIENT_DRAFT: ClientDraftValues = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  status: 'prospect',
  type: '',
  serviceLine: '',
  source: '',
  city: '',
  state: '',
  tags: [],
  ownerId: '',
  notes: '',
  lastContactAt: '',
}

/** Whether the query narrows the list, which decides between the empty and the no-results state. */
export function isFilteredClientQuery(query: ClientQuery) {
  return (
    query.search !== '' ||
    query.statuses.length > 0 ||
    query.ownerIds.length > 0 ||
    query.types.length > 0 ||
    query.serviceLines.length > 0 ||
    query.sources.length > 0 ||
    query.states.length > 0 ||
    query.tags.length > 0
  )
}

export interface ClientRow {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  status: ClientStatus
  type: string
  serviceLine: string
  source: string
  city: string
  state: string
  tags: string[]
  notes: string
  ownerId: string
  /** Resolved from the member list so the table never renders a raw user id. */
  ownerName: string
  /** ISO strings: a Date would cross the server-action boundary as a less predictable value. */
  lastContactAt: string | undefined
  createdAt: string
  archivedAt: string | undefined
}

export interface ClientsPage {
  rows: ClientRow[]
  pageInfo: PageInfo
}

export type ClientOptionMap = Record<ClientLookupKind, string[]>

export interface ClientFilterOptions {
  owners: { id: string; name: string }[]
  options: ClientOptionMap
}

export function emptyOptionMap(): ClientOptionMap {
  return {
    clientType: [],
    clientServiceLine: [],
    clientSource: [],
    clientCity: [],
    clientState: [],
    clientTag: [],
  }
}

/** The form takes strings; the row it edits carries the same shape plus resolved extras. */
export function draftOf(row: ClientRow): UpdateClientValues {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    status: row.status,
    type: row.type,
    serviceLine: row.serviceLine,
    source: row.source,
    city: row.city,
    state: row.state,
    tags: row.tags,
    ownerId: row.ownerId,
    notes: row.notes,
    lastContactAt: row.lastContactAt ? row.lastContactAt.slice(0, 10) : '',
  }
}
