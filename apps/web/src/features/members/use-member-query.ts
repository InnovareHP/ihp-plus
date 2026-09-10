'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { DEFAULT_MEMBER_QUERY, memberQuerySchema, type MemberQuery } from './schema'

// Filters that can hold several values arrive as `?x=a,b` or as repeated params.
const MULTI_KEYS = ['organizationRoles', 'portalRoles', 'employmentTypes', 'teamIds'] as const

export function parseMemberQuery(params: URLSearchParams): MemberQuery {
  const raw: Record<string, unknown> = Object.fromEntries(params.entries())

  for (const key of MULTI_KEYS) {
    const values = params.getAll(key)
    if (values.length > 0) raw[key] = values.flatMap((value) => value.split(','))
  }

  return memberQuerySchema.parse(raw)
}

export function memberQueryHref(pathname: string, query: MemberQuery) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','))
      continue
    }
    // A value already at its default stays out of the URL, so a shared link carries only intent.
    if (
      value === undefined ||
      value === '' ||
      value === DEFAULT_MEMBER_QUERY[key as keyof MemberQuery]
    ) {
      continue
    }
    params.set(key, String(value))
  }

  const search = params.toString()
  return search ? `${pathname}?${search}` : pathname
}

/** The members list reads its page, sort and filters from the URL so both are shareable. */
export function useMemberQuery() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const query = useMemo(
    () => parseMemberQuery(new URLSearchParams(searchParams?.toString() ?? '')),
    [searchParams],
  )

  const setQuery = useCallback(
    (patch: Partial<MemberQuery>) => {
      const next = { ...query, ...patch }
      // Narrowing or re-sorting invalidates the page number the user was on.
      if (patch.page === undefined) next.page = 1
      // replace, not push: adjusting a filter must not fill the back stack.
      router.replace(memberQueryHref(pathname, next), { scroll: false })
    },
    [pathname, query, router],
  )

  const clearFilters = useCallback(
    () => router.replace(memberQueryHref(pathname, DEFAULT_MEMBER_QUERY), { scroll: false }),
    [pathname, router],
  )

  return { query, setQuery, clearFilters }
}
