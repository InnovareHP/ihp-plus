'use client'

import { Select } from '@mantine/core'
import { usePayTerms, useSetPayTerms } from '../hooks/use-statements'

export interface MemberPaySelectProps {
  userId: string
  /** Named in the control's accessible name, since the row header is a cell away. */
  userName: string
}

const OPTIONS = [
  { value: 'hourly', label: 'Hourly rate' },
  { value: 'fixed', label: 'Fixed pay' },
]

/** How a contractor bills: hours × an hourly rate, or one flat amount per statement. */
export function MemberPaySelect({ userId, userName }: MemberPaySelectProps) {
  const terms = usePayTerms()
  const set = useSetPayTerms()
  const fixedPay = terms.data?.find((row) => row.userId === userId)?.fixedPay ?? false

  return (
    <Select
      aria-label={`Pay basis for ${userName}`}
      data={OPTIONS}
      value={fixedPay ? 'fixed' : 'hourly'}
      allowDeselect={false}
      disabled={terms.isPending}
      size="sm"
      w={140}
      comboboxProps={{ withinPortal: true }}
      onChange={(value) => set.mutate({ userId, fixedPay: value === 'fixed' })}
    />
  )
}
