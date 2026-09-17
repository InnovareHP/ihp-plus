import { z } from 'zod'
import type { LookupKind } from '@/features/lookups/schema'
import { paginationSchema, sortDirectionSchema, type PageInfo } from '@/lib/pagination'

/** The one curated list this screen owns; categories are what a shelf is sorted by. */
export const BLUEBOOK_LOOKUP_KINDS = ['bluebookCategory'] as const satisfies readonly LookupKind[]

/** The all-departments shelf. Anything else is a department id. */
export const COMPANY_SHELF = 'company'

export const BLUEBOOK_VIEWS = ['active', 'archived'] as const
// Departments are a to-many relation now, and Prisma cannot order by one, so the shelf is
// filter-only — the same constraint the members list documents for its own department column.
export const BLUEBOOK_SORT_KEYS = ['title', 'category', 'createdAt', 'byteSize'] as const

// nginx caps a request body at 25m (infra/docker/nginx/proxy.conf), so a larger file could not
// reach the server even if Next allowed it.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/** What a handbook is made of: documents, spreadsheets, slides, scans and plain text. */
export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.ms-powerpoint': 'PowerPoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'text/plain': 'Text',
  'text/csv': 'CSV',
  'image/png': 'Image',
  'image/jpeg': 'Image',
  'image/webp': 'Image',
}

export const ACCEPTED_EXTENSIONS =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp'

/** The same check client- and server-side, so the message a user reads is the rule enforced. */
export function fileProblem(file: { name: string; size: number; type: string }) {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_UPLOAD_BYTES) return 'Files have to be 25 MB or smaller.'
  if (!ALLOWED_UPLOAD_TYPES[file.type]) {
    return 'Upload a PDF, Office document, text file or image.'
  }
  return undefined
}

const csvValues = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((raw) => (typeof raw === 'string' ? raw.split(',') : (raw ?? [])))
  .transform((list) =>
    list
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 50),
  )

export const bluebookQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).catch('').default(''),
  categories: csvValues,
  /** '' is every shelf, 'company' the all-departments one, anything else a department id. */
  shelf: z.string().trim().max(64).catch('').default(''),
  view: z.enum(BLUEBOOK_VIEWS).catch('active'),
  sortBy: z.enum(BLUEBOOK_SORT_KEYS).catch('createdAt'),
  sortDirection: sortDirectionSchema.catch('desc'),
})

export const documentDraftSchema = z.object({
  title: z.string().trim().min(2, 'Give the document a title.').max(140),
  description: z.string().trim().max(500, 'Keep the summary under 500 characters.'),
  category: z.string().trim().max(80),
  /**
   * Every shelf it is filed on: department ids, or COMPANY_SHELF on its own for the
   * all-departments shelf. Normalized rather than rejected — "all departments plus Finance"
   * is a contradiction the picker should not have allowed, and collapsing it is what the
   * user meant.
   */
  shelves: z
    .array(z.string().trim().min(1).max(64))
    .min(1, 'Choose at least one department.')
    .max(40)
    .transform((values) => {
      const unique = [...new Set(values)]
      return unique.includes(COMPANY_SHELF) ? [COMPANY_SHELF] : unique
    }),
})

export const updateDocumentSchema = documentDraftSchema.extend({ id: z.string().min(1) })
export const documentIdSchema = z.object({ id: z.string().min(1) })

export type BluebookView = (typeof BLUEBOOK_VIEWS)[number]
export type BluebookSortKey = (typeof BLUEBOOK_SORT_KEYS)[number]
export type BluebookQuery = z.infer<typeof bluebookQuerySchema>
export type DocumentDraftValues = z.infer<typeof documentDraftSchema>
// The schema normalizes, so what the form holds while being edited is its input side.
export type DocumentDraftInput = z.input<typeof documentDraftSchema>
export type UpdateDocumentValues = z.infer<typeof updateDocumentSchema>
export type UpdateDocumentInput = z.input<typeof updateDocumentSchema>

export const DEFAULT_BLUEBOOK_QUERY: BluebookQuery = bluebookQuerySchema.parse({})

export const EMPTY_DOCUMENT_DRAFT: DocumentDraftInput = {
  title: '',
  description: '',
  category: '',
  shelves: [COMPANY_SHELF],
}

export function isFilteredBluebookQuery(query: BluebookQuery) {
  return query.search !== '' || query.categories.length > 0 || query.shelf !== ''
}

export interface DocumentRow {
  id: string
  title: string
  description: string
  category: string
  /** Every department shelf it sits on. Empty is the company-wide shelf. */
  teams: { id: string; name: string }[]
  fileName: string
  contentType: string
  byteSize: number
  uploadedByName: string
  createdAt: string
  archivedAt: string | undefined
  /** Whether this viewer may edit, archive or restore this row — an admin, or the shelf's lead. */
  canManage: boolean
  /** When this viewer confirmed reading it; absent until they do. */
  acknowledgedAt: string | undefined
  /** Confirmed reads, filled only on a row the viewer manages. */
  readCount: number | undefined
  /** The people it is filed for, filled only on a row the viewer manages. */
  audienceCount: number | undefined
}

export interface DocumentsPage {
  rows: DocumentRow[]
  pageInfo: PageInfo
}

export interface ShelfOption {
  /** COMPANY_SHELF or a department id. */
  value: string
  label: string
  documentCount: number
  canUpload: boolean
}

export interface BluebookOptions {
  shelves: ShelfOption[]
  categories: string[]
  /** True for a portal admin or organization owner/admin: they curate lists and purge files. */
  isAdmin: boolean
}

export function shelfLabel(row: DocumentRow) {
  return row.teams.length === 0 ? 'All departments' : row.teams.map((team) => team.name).join(', ')
}

export function draftOf(row: DocumentRow): UpdateDocumentInput {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    shelves: row.teams.length === 0 ? [COMPANY_SHELF] : row.teams.map((team) => team.id),
  }
}
