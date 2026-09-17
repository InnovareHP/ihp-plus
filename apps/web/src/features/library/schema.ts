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
