'use client'

import { MultiSelect } from '@mantine/core'
import { MENTION_EVERYONE, MENTION_EVERYONE_LABEL, type TaskAssigneeRef } from '../schema'

export interface NotifySelectProps {
  colleagues: readonly TaskAssigneeRef[]
  value: readonly string[]
  onChange: (next: string[]) => void
  onBlur?: () => void
}

export function NotifySelect({ colleagues, value, onChange, onBlur }: NotifySelectProps) {
  return (
    <MultiSelect
      label="Notify"
      description="They get an email with this comment. @everyone reaches the whole team."
      placeholder={value.length ? undefined : 'Nobody yet'}
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
