'use client'

import { useDebouncedCallback } from '@mantine/hooks'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// Filters and search text are URL state: shareable, survivable across a reload, and restored
// by the back button. The input itself stays a react-hook-form field.
export function useUrlQueryParam(key: string, delayMs = 300) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const commit = useDebouncedCallback((next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next) {
      params.set(key, next)
    } else {
      params.delete(key)
    }
    const query = params.toString()
    // replace, not push: adjusting a filter must not fill the back stack.
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, delayMs)

  return { value: searchParams.get(key) ?? '', commit }
}
