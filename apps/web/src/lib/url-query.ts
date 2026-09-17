'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import type { ZodType } from 'zod'

/**
 * A list's page, sort and filters are URL state: shareable, restored by the back button, and
 * parsed by the same schema the server action validates with.
 */
export function searchParamsParser<TQuery>(
  schema: ZodType<TQuery>,
  multiKeys: readonly string[] = [],
) {
  return (params: URLSearchParams): TQuery => {
    const raw: Record<string, unknown> = Object.fromEntries(params.entries())

    // A multi-value filter is written `?x=a,b` or as repeated params; both reach the schema as one array.
    for (const key of multiKeys) {
      const values = params.getAll(key)
      if (values.length > 0) raw[key] = values.flatMap((value) => value.split(','))
    }

    return schema.parse(raw)
  }
}

export function queryToHref<TQuery extends Record<string, unknown>>(
  pathname: string,
  query: TQuery,
  defaults: TQuery,
  /** Params already in the URL that this query does not own, e.g. which tab is open. */
  carry?: URLSearchParams,
) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','))
      continue
    }
    // A value already at its default stays out of the URL, so a shared link carries only intent.
    if (value === undefined || value === '' || value === defaults[key]) continue
    params.set(key, String(value))
  }

  // Anything this list does not own stays: a filter change must not close the tab it is on.
  for (const [key, value] of carry ?? []) {
    if (!(key in query)) params.set(key, value)
  }

  const search = params.toString()
  return search ? `${pathname}?${search}` : pathname
}

export interface UrlQuery<TQuery> {
  query: TQuery
  setQuery: (patch: Partial<TQuery>) => void
  clearFilters: () => void
}

export function useUrlQuery<TQuery extends Record<string, unknown>>(
  parse: (params: URLSearchParams) => TQuery,
  defaults: TQuery,
): UrlQuery<TQuery> {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const current = useCallback(
    () => new URLSearchParams(searchParams?.toString() ?? ''),
    [searchParams],
  )

  const query = useMemo(() => parse(current()), [current, parse])

  const setQuery = useCallback(
    (patch: Partial<TQuery>) => {
      const next: Record<string, unknown> = { ...query, ...patch }
      // Narrowing or re-sorting invalidates the page number the user was on.
      if (patch.page === undefined && 'page' in defaults) next.page = 1
      // replace, not push: adjusting a filter must not fill the back stack.
      router.replace(queryToHref(pathname, next as TQuery, defaults, current()), { scroll: false })
    },
    [current, defaults, pathname, query, router],
  )

  const clearFilters = useCallback(
    () => router.replace(queryToHref(pathname, defaults, defaults, current()), { scroll: false }),
    [current, defaults, pathname, router],
  )

  return { query, setQuery, clearFilters }
}
