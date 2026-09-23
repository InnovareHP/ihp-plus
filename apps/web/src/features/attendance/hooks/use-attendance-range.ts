'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { shiftDateKey } from '@ihp/clock'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export interface AttendanceRangeState {
  from: string
  to: string
  userId: string
  setRange: (next: { from?: string; to?: string; userId?: string }) => void
}

/** The range and whose it is are URL state: a timesheet link has to open on the same rows. */
export function useAttendanceRange(defaultDays = 14): AttendanceRangeState {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const to = searchParams.get('to')
  const from = searchParams.get('from')
  const end = to && DATE_KEY.test(to) ? to : todayKey()
  const start = from && DATE_KEY.test(from) ? from : shiftDateKey(end, -(defaultDays - 1))

  const setRange = useCallback(
    (next: { from?: string; to?: string; userId?: string }) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        const param = key === 'userId' ? 'user' : key
        if (value) params.set(param, value)
        else params.delete(param)
      }
      const query = params.toString()
      // replace, not push: adjusting a range must not fill the back stack.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return { from: start, to: end, userId: searchParams.get('user') ?? '', setRange }
}
