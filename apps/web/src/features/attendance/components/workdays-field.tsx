'use client'

import { Checkbox, Group, Input } from '@mantine/core'
import { parseWorkdays, WEEKDAY_LABELS } from '../utils/clock'

export interface WorkdaysFieldProps {
  value: string
  onChange: (next: string) => void
  onBlur?: () => void
  error?: string
  label?: string
  description?: string
}

/** The comma list the shift is stored as, edited as the seven days people think in. */
export function WorkdaysField({
  value,
  onChange,
  onBlur,
  error,
  label = 'Working days',
  description = 'The days this shift is expected; others never count as late.',
}: WorkdaysFieldProps) {
  const selected = parseWorkdays(value)

  function toggle(day: number, checked: boolean) {
    const next = checked ? [...selected, day] : selected.filter((one) => one !== day)
    onChange([...new Set(next)].sort((a, b) => a - b).join(','))
  }

  return (
    <Input.Wrapper
      label={label}
      description={description}
      error={error}
      errorProps={{ role: 'alert' }}
    >
      <Group gap="sm" mt="xs" role="group" aria-label={label}>
        {WEEKDAY_LABELS.map((name, day) => (
          <Checkbox
            key={name}
            label={name}
            checked={selected.includes(day)}
            onChange={(event) => toggle(day, event.currentTarget.checked)}
            onBlur={onBlur}
          />
        ))}
      </Group>
    </Input.Wrapper>
  )
}
