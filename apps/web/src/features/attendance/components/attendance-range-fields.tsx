'use client'

import { SimpleGrid, TextInput } from '@mantine/core'

export interface AttendanceRangeFieldsProps {
  from: string
  to: string
  onChange: (next: { from?: string; to?: string }) => void
}

/** The range every timesheet screen is read through, kept in the URL by its owner. */
export function AttendanceRangeFields({ from, to, onChange }: AttendanceRangeFieldsProps) {
  return (
    // Two dates side by side at any width, filling a phone's row instead of sitting at odd sizes.
    <SimpleGrid cols={2} spacing="sm" w={{ base: '100%', sm: 'auto' }}>
      <TextInput
        type="date"
        label="From"
        value={from}
        max={to}
        onChange={(event) => onChange({ from: event.currentTarget.value })}
      />
      <TextInput
        type="date"
        label="To"
        value={to}
        min={from}
        onChange={(event) => onChange({ to: event.currentTarget.value })}
      />
    </SimpleGrid>
  )
}
