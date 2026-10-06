import { Alert, Text } from '@mantine/core'
import { IconAlertTriangle, IconCalendarEvent } from '@tabler/icons-react'
import { afterRequest, formatLeaveDays } from '../balance'
import type { LeavePreview } from '../schema'

export interface LeavePreviewNoticeProps {
  preview: LeavePreview
  /** Who the balance belongs to: "you" for the requester, their name for an approver. */
  whose: 'mine' | { name: string }
}

function daysCopy(workingDays: number) {
  if (workingDays === 0) return 'These dates fall on days off, so they use no leave.'
  return `This request uses ${formatLeaveDays(workingDays)} of leave, not counting weekends and holidays.`
}

function balanceCopy(preview: LeavePreview, whose: LeavePreviewNoticeProps['whose']) {
  const { balance, workingDays } = preview
  if (!balance) return undefined

  const subject = whose === 'mine' ? 'You have' : `${whose.name} has`
  const pending =
    balance.pending > 0
      ? `, with ${formatLeaveDays(balance.pending)} more waiting for approval`
      : ''
  const now = `${subject} ${formatLeaveDays(balance.remaining)} of ${balance.allowance} ${balance.formName} left this year${pending}.`

  const { left, over } = afterRequest(balance, workingDays)
  if (!over) return { text: now, over }

  const consequence =
    whose === 'mine'
      ? `That is ${formatLeaveDays(-left)} more than you have left. You can still send it; your approver decides.`
      : `Approving it puts them ${formatLeaveDays(-left)} over their allowance.`
  return { text: `${now} ${consequence}`, over }
}

export function LeavePreviewNotice({ preview, whose }: LeavePreviewNoticeProps) {
  const balance = balanceCopy(preview, whose)
  const over = balance?.over ?? false

  return (
    <Alert
      variant="light"
      color={over ? 'yellow' : 'blue'}
      icon={
        over ? <IconAlertTriangle aria-hidden="true" /> : <IconCalendarEvent aria-hidden="true" />
      }
      title={over ? 'Over the allowance' : undefined}
      role="status"
    >
      <Text size="sm">{daysCopy(preview.workingDays)}</Text>
      {balance ? (
        <Text size="sm" mt={4}>
          {balance.text}
        </Text>
      ) : null}
    </Alert>
  )
}
