import { z } from 'zod'
import { sortDirectionSchema } from '@/lib/pagination'

export const LIBRARY_SORT_KEYS = ['name', 'lastModifiedAt', 'size'] as const

export type LibrarySortKey = (typeof LIBRARY_SORT_KEYS)[number]

/** Which folder is open, and how it is ordered — all of it linkable. */
export const libraryQuerySchema = z.object({
  path: z.string().trim().max(400).catch(''),
  sortBy: z.enum(LIBRARY_SORT_KEYS).catch('name'),
  sortDirection: sortDirectionSchema.catch('asc'),
})

export type LibraryQuery = z.infer<typeof libraryQuerySchema>

export const DEFAULT_LIBRARY_QUERY = libraryQuerySchema.parse({})

export const libraryItemSchema = z.object({ itemId: z.string().min(1).max(200) })

/** Matches next.config's serverActions bodySizeLimit and nginx's client_max_body_size. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export function uploadProblem(file: { size: number }) {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_UPLOAD_BYTES) return 'Files have to be 25 MB or smaller.'
  return undefined
}

/** SharePoint refuses these outright, so the form says so before the upload is attempted. */
export const itemNameSchema = z
  .string()
  .trim()
  .min(1, 'Give it a name.')
  .max(200, 'That name is too long.')
  .regex(/^[^"*:<>?/\\|#%]+$/, 'A name cannot contain " * : < > ? / \\ | # or %.')
  .refine((name) => !/^\.|\.$/.test(name), 'A name cannot start or end with a dot.')

export const newFolderSchema = z.object({ name: itemNameSchema })

export type NewFolderValues = z.infer<typeof newFolderSchema>

export const EMPTY_NEW_FOLDER: NewFolderValues = { name: '' }

export const renameItemSchema = z.object({
  itemId: z.string().min(1).max(200),
  name: itemNameSchema,
})

export type RenameItemValues = z.infer<typeof renameItemSchema>

export const createFolderSchema = z.object({
  path: z.string().trim().max(400),
  name: itemNameSchema,
})

export interface LibraryEntry {
  id: string
  name: string
  isFolder: boolean
  /** The path that opens a folder; a file keeps its own for the row's accessible name. */
  path: string
  size: number | undefined
  contentType: string | undefined
  lastModifiedAt: string | undefined
  childCount: number | undefined
}

export interface LibraryListing {
  path: string
  entries: LibraryEntry[]
}
