import { z } from 'zod'

export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25
// A hostile ?pageSize=100000 would otherwise read the whole table into memory.
const MAX_PAGE_SIZE = 100

export const sortDirectionSchema = z.enum(['asc', 'desc'])

// .catch() rather than a strict parse: a stale or hand-edited URL falls back instead of erroring.
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
})

export type SortDirection = z.infer<typeof sortDirectionSchema>
export type PaginationQuery = z.infer<typeof paginationSchema>

export interface PageInfo {
  page: number
  pageSize: number
  total: number
  pageCount: number
  hasPrevious: boolean
  hasNext: boolean
}

export interface Paginated<TRow> {
  rows: TRow[]
  pageInfo: PageInfo
}

// Narrowing a filter can leave ?page= past the end, so the page is clamped to what exists.
export function pageInfoOf({
  page,
  pageSize,
  total,
}: PaginationQuery & { total: number }): PageInfo {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(page, 1), pageCount)

  return {
    page: current,
    pageSize,
    total,
    pageCount,
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  }
}

export function skipTake(pageInfo: PageInfo) {
  return { skip: (pageInfo.page - 1) * pageInfo.pageSize, take: pageInfo.pageSize }
}

/** The 1-based row range this page covers, for "Showing 26–50 of 214". */
export function pageRangeOf(pageInfo: PageInfo) {
  const from = pageInfo.total === 0 ? 0 : (pageInfo.page - 1) * pageInfo.pageSize + 1
  return { from, to: Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.total) }
}
