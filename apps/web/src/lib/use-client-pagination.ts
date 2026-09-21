'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import {
  DEFAULT_PAGE_SIZE,
  pageInfoOf,
  paginationSchema,
  skipTake,
  type PageInfo,
} from './pagination'

export interface ClientPagination<TRow> {
  rows: TRow[] | undefined
  /** Undefined while the query is pending, so the table shows its skeleton rather than "0 of 0". */
  pageInfo: PageInfo | undefined
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export interface ClientPaginationOptions {
  /** The URL param holding the page; a second table on the same screen needs its own. */
  key?: string
  pageSize?: number
}

/**
 * Paging for a list the client already holds in full — a bounded one, such as the departments
 * or a folder's children. An unbounded list is paged by the server instead, so the browser
 * never loads what it will not show.
 */
export function useClientPagination<TRow>(
  rows: readonly TRow[] | undefined,
  { key = 'page', pageSize = DEFAULT_PAGE_SIZE }: ClientPaginationOptions = {},
): ClientPagination<TRow> {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const sizeKey = `${key}Size`
  const query = paginationSchema.parse({
    page: searchParams?.get(key) ?? 1,
    pageSize: searchParams?.get(sizeKey) ?? pageSize,
  })

  const setParams = useCallback(
    (patch: Record<string, number | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      for (const [name, value] of Object.entries(patch)) {
        if (value === undefined) params.delete(name)
        else params.set(name, String(value))
      }
      const search = params.toString()
      // replace, not push: turning a page must not fill the back stack.
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const pageInfo = rows
    ? pageInfoOf({ page: query.page, pageSize: query.pageSize, total: rows.length })
    : undefined

  const page = useMemo(() => {
    if (!rows || !pageInfo) return undefined
    const { skip, take } = skipTake(pageInfo)
    return rows.slice(skip, skip + take)
  }, [rows, pageInfo])

  return {
    rows: page,
    pageInfo,
    onPageChange: useCallback((next: number) => setParams({ [key]: next }), [key, setParams]),
    onPageSizeChange: useCallback(
      // A bigger page can put the reader past the end, so the size change starts them over.
      (next: number) => setParams({ [sizeKey]: next, [key]: 1 }),
      [key, sizeKey, setParams],
    ),
  }
}
