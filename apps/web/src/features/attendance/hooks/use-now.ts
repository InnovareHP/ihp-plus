'use client'

import { useEffect, useState } from 'react'

/** The wall clock is an external source: a running day has to tick without a refetch. */
export function useNow(active: boolean, everyMs = 1000) {
  const [now, setNow] = useState(() => Date.now())

  // Synchronises with the wall clock while something on screen is counting.
  useEffect(() => {
    if (!active) return

    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [active, everyMs])

  return now
}
