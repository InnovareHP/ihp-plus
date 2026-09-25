'use client'

import { Badge, VisuallyHidden } from '@mantine/core'
import { useBulletinUnread } from '../hooks/use-bulletin-unread'

// A failed or pending count shows nothing: a badge is a nudge, never a blocker.
export function BulletinUnreadBadge() {
  const unread = useBulletinUnread()
  const count = unread.data ?? 0
  if (count === 0) return null

  return (
    <Badge size="sm" circle={count < 10} variant="filled">
      {count > 9 ? '9+' : count}
      <VisuallyHidden> new</VisuallyHidden>
    </Badge>
  )
}
