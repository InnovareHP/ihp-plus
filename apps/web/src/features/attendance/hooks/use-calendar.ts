'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { attendanceKeys } from '../query-keys'
import { getCalendar } from '../rpc'
import { isMonthKey } from '../utils/calendar'

/** The month on screen is URL state, so a link opens the same month and back returns to it. */
export function useCalendarMonth() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const raw = searchParams.get('month') ?? ''

  function setMonth(month: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (month) params.set('month', month)
    else params.delete('month')
    const query = params.toString()
    // replace, not push: paging through months must not fill the back stack.
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  // Empty asks the server for this month in the company zone, which the browser cannot know.
  return { month: isMonthKey(raw) ? raw : '', setMonth }
}

export function useCalendar(month: string) {
  return useQuery({
    queryKey: attendanceKeys.calendar(month),
    queryFn: () => getCalendar(month),
    // The previous month stays on screen while the next one loads, instead of a blank grid.
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })
}
