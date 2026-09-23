'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { attendanceKeys } from '../query-keys'
import { getCalendar, getTeamCalendar } from '../rpc'
import { isMonthKey } from '../utils/calendar'

/** The month and whose it is are URL state, so a link opens the same view and back returns to it. */
export function useCalendarParams() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const raw = searchParams.get('month') ?? ''

  function setParam(key: 'month' | 'user', value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    const query = params.toString()
    // replace, not push: paging through months must not fill the back stack.
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return {
    // Empty asks the server for this month in the company zone, which the browser cannot know.
    month: isMonthKey(raw) ? raw : '',
    userId: searchParams.get('user') ?? '',
    setMonth: (month: string) => setParam('month', month),
    setUserId: (userId: string) => setParam('user', userId),
  }
}

export function useCalendar(month: string, userId = '', enabled = true) {
  return useQuery({
    queryKey: attendanceKeys.calendar(month, userId),
    queryFn: () => getCalendar(month, userId),
    enabled,
    // The previous month stays on screen while the next one loads, instead of a blank grid.
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })
}

export function useTeamCalendar(month: string, enabled = true) {
  return useQuery({
    queryKey: attendanceKeys.teamCalendar(month),
    queryFn: () => getTeamCalendar(month),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })
}
