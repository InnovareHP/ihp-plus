import { Select } from '@mantine/core'

export interface EmploymentStatusSelectProps {
  userName: string
  value: string | undefined
  statuses: readonly string[]
  onChange: (value: string) => void
  /** A visible label, for a form rather than a table cell; the control then fills its row. */
  label?: string
}

export function EmploymentStatusSelect({
  userName,
  value,
  statuses,
  onChange,
  label,
}: EmploymentStatusSelectProps) {
  return (
    <Select
      label={label}
      aria-label={label ? undefined : `Employment status for ${userName}`}
      // A retired status the person still holds is seeded in, so the control shows what is saved.
      data={value && !statuses.includes(value) ? [value, ...statuses] : [...statuses]}
      value={value ?? null}
      placeholder="Not set"
      size="sm"
      w={label ? '100%' : 150}
      comboboxProps={{ withinPortal: true }}
      onChange={(next) => onChange(next ?? '')}
    />
  )
}
