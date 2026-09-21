'use client'

import { MultiSelect } from '@mantine/core'
import { IconAt } from '@tabler/icons-react'
import { MENTION_EVERYONE, MENTION_EVERYONE_LABEL, type TaskAssigneeRef } from '../schema'

export interface NotifySelectProps {
  colleagues: readonly TaskAssigneeRef[]
  value: readonly string[]
  onChange: (next: string[]) => void
  onBlur?: () => void
}

/** The @ carries it: a labelled field would shout louder than the comment it decorates. */
export function NotifySelect({ colleagues, value, onChange, onBlur }: NotifySelectProps) {
  return (
    <MultiSelect
      aria-label="Notify"
      size="sm"
      variant="unstyled"
      leftSection={<IconAt size={14} aria-hidden />}
      placeholder={value.length ? undefined : 'Notify someone'}
      data={[
        { value: MENTION_EVERYONE, label: MENTION_EVERYONE_LABEL },
        ...colleagues.map((person) => ({ value: person.userId, label: person.name })),
      ]}
      value={[...value]}
      // Naming people on top of everyone reaches nobody extra, so the wider pick wins.
      onChange={(next) => onChange(next.includes(MENTION_EVERYONE) ? [MENTION_EVERYONE] : next)}
      onBlur={onBlur}
      searchable
      clearable
      nothingFoundMessage="Nobody by that name"
    />
  )
}
