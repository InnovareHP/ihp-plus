import { Badge } from '@mantine/core'
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'
import classes from './verified-badge.module.css'

// Neutral text plus an icon, because the light green and yellow badges failed AA on white.
export function VerifiedBadge({ verified }: { verified: boolean }) {
  const Icon = verified ? IconCircleCheck : IconAlertTriangle
  return (
    <Badge
      variant="default"
      size="sm"
      tt="none"
      ml={6}
      leftSection={
        <Icon size={12} aria-hidden className={verified ? classes.verified : classes.unverified} />
      }
    >
      {verified ? 'Verified' : 'Unverified'}
    </Badge>
  )
}
