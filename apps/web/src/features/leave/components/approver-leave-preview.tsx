'use client'

import { Skeleton } from '@mantine/core'
import { useLeavePreview } from '../hooks/use-balances'
import { LeavePreviewNotice } from './leave-preview-notice'

export interface ApproverLeavePreviewProps {
  submissionId: string
  requesterName: string
}

/** The balance a pending request comes out of, so the approver decides with it in view. */
export function ApproverLeavePreview({ submissionId, requesterName }: ApproverLeavePreviewProps) {
  const preview = useLeavePreview({ submissionId })

  if (preview.isPending) return <Skeleton height={72} radius="md" aria-busy="true" />
  // The decision does not depend on it, so a failed count stays out of the approver's way.
  if (preview.isError) return null
  return <LeavePreviewNotice preview={preview.data} whose={{ name: requesterName }} />
}
