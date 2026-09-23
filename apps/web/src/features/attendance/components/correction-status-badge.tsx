import { Badge } from '@mantine/core'
import type { CorrectionStatus } from '../schema'

const LOOK: Record<CorrectionStatus, { color: string; label: string }> = {
  pending: { color: 'yellow', label: 'Waiting for an admin' },
  approved: { color: 'green', label: 'Corrected' },
  rejected: { color: 'red', label: 'Turned down' },
  withdrawn: { color: 'gray', label: 'Withdrawn' },
}

export function CorrectionStatusBadge({ status }: { status: CorrectionStatus }) {
  const look = LOOK[status]
  return (
    <Badge color={look.color} variant="light">
      {look.label}
    </Badge>
  )
}
