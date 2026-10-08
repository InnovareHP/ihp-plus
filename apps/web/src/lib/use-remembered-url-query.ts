'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useUrlQuery, type UrlQuery } from './url-query'

// Storage can throw (private mode, blocked site data), so a failure only costs the memory.
function readRemembered(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey) ?? ''
  } catch {
    return ''
  }
}

function writeRemembered(storageKey: string, search: string) {
  try {
    if (search) window.localStorage.setItem(storageKey, search)
    else window.localStorage.removeItem(storageKey)
  } catch {
    // Nothing to do: the URL still holds the filters for this visit.
  }
}

/** The params worth bringing back next visit: everything but the ones that open one thing. */
export function rememberedSearch(params: URLSearchParams, transient: readonly string[]) {
  const kept = new URLSearchParams(params)
  for (const key of transient) kept.delete(key)
  return kept.toString()
}

/**
 * A URL query that this browser remembers: opening the page bare (from the sidebar, a fresh
 * tab) brings back the filters left last time, while a link carrying its own filters wins.
 */
export function useRememberedUrlQuery<TQuery extends Record<string, unknown>>(
  storageKey: string,
  parse: (params: URLSearchParams) => TQuery,
  defaults: TQuery,
  transient: readonly (keyof TQuery & string)[] = [],
): UrlQuery<TQuery> {
  const url = useUrlQuery(parse, defaults)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const restored = useRef(false)
  const search = searchParams?.toString() ?? ''
  // A string, so a fresh array each render does not rerun the effect.
  const transientKeys = transient.join(',')

  // localStorage is the external store: read after hydration so the server HTML still matches.
  useEffect(() => {
    const params = new URLSearchParams(search)
    const own = rememberedSearch(params, transientKeys.split(','))
    if (!restored.current) {
      restored.current = true
      // A link to one task carries no filters of its own, so it opens inside the saved ones.
      const saved = own ? '' : readRemembered(storageKey)
      if (saved) {
        const merged = new URLSearchParams(saved)
        for (const [key, value] of params) merged.set(key, value)
        router.replace(`${pathname}?${merged.toString()}`, { scroll: false })
        return
      }
    }
    writeRemembered(storageKey, own)
  }, [search, storageKey, transientKeys, pathname, router])

  return url
}
