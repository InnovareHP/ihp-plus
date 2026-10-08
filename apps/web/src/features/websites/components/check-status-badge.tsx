import { Badge } from '@mantine/core'
import { IconAlertTriangle, IconCircleCheck, IconCircleX } from '@tabler/icons-react'
import { CHECK_STATUS_COLORS, CHECK_STATUS_LABELS, type CheckStatus } from '../schema'

const ICONS = {
  up: IconCircleCheck,
  issue: IconAlertTriangle,
  down: IconCircleX,
} as const

// The icon and the word carry the status too, so it never rests on colour alone.
export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  const Icon = ICONS[status]
  return (
    <Badge
      color={CHECK_STATUS_COLORS[status]}
      variant="light"
      leftSection={<Icon size={14} aria-hidden />}
    >
      {CHECK_STATUS_LABELS[status]}
    </Badge>
  )
}
