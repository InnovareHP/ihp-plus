'use client'

import { useDebouncedValue } from '@mantine/hooks'
import { useLeavePreview } from '../hooks/use-balances'
import { LeavePreviewNotice } from './leave-preview-notice'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export interface RequestLeavePreviewProps {
  formId: string
  firstDay: unknown
  lastDay: unknown
}

/** What the dates being picked will cost, counted on the requester's own shift. */
export function RequestLeavePreview({ formId, firstDay, lastDay }: RequestLeavePreviewProps) {
  // Typing a date one digit at a time must not fire a count per keystroke.
  const [from] = useDebouncedValue(typeof firstDay === 'string' ? firstDay : '', 300)
  const [to] = useDebouncedValue(typeof lastDay === 'string' ? lastDay : '', 300)
  const ready = DATE_KEY.test(from) && DATE_KEY.test(to) && from <= to
  const preview = useLeavePreview(ready ? { formId, firstDay: from, lastDay: to } : undefined)

  // A range the form itself rejects already shows its own error under the date field.
  if (!ready || !preview.data) return null
  return <LeavePreviewNotice preview={preview.data} whose="mine" />
}
