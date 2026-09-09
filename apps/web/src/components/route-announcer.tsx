'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// Synchronises the assistive-tech announcement with document.title, which React does not own.
export function RouteAnnouncer() {
  const pathname = usePathname()
  const [message, setMessage] = useState('')

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMessage(document.title))
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <p
      aria-live="assertive"
      aria-atomic="true"
      role="status"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        margin: -1,
        padding: 0,
        overflow: 'hidden',
        clip: 'rect(0 0 0 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {message}
    </p>
  )
}
