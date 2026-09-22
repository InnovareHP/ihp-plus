'use client'

import { Group, TextInput } from '@mantine/core'

export interface AttendanceRangeFieldsProps {
  from: string
  to: string
  onChange: (next: { from?: string; to?: string }) => void
}

/** The range every timesheet screen is read through, kept in the URL by its owner. */
export function AttendanceRangeFields({ from, to, onChange }: AttendanceRangeFieldsProps) {
  return (
    <Group gap="sm" align="flex-end" wrap="wrap">
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
    </Group>
  )
}
