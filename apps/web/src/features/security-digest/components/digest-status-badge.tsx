import { Badge } from '@mantine/core'
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconClockHour4,
  IconSend,
} from '@tabler/icons-react'
import { DIGEST_STATUS_COLORS, DIGEST_STATUS_LABELS, type DigestStatus } from '../schema'

const ICONS = {
  draft: IconClockHour4,
  approved: IconCircleCheck,
  sent: IconSend,
  rejected: IconCircleX,
  failed: IconAlertTriangle,
} as const

// The icon and the word carry the status too, so it never rests on colour alone.
export function DigestStatusBadge({ status }: { status: DigestStatus }) {
  const Icon = ICONS[status]
  return (
    <Badge
      color={DIGEST_STATUS_COLORS[status]}
      variant="light"
      leftSection={<Icon size={14} aria-hidden />}
    >
      {DIGEST_STATUS_LABELS[status]}
    </Badge>
  )
}
