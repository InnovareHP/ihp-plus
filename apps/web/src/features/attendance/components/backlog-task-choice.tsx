'use client'

import { Fieldset, Group, SegmentedControl, Text } from '@mantine/core'
import {
  BACKLOG_ACTION_LABELS,
  BACKLOG_ACTIONS,
  type BacklogAction,
  type BacklogTaskRow,
} from '../schema'

export interface BacklogTaskChoiceProps {
  task: BacklogTaskRow
  value: BacklogAction
  onChange: (value: BacklogAction) => void
}

const dueFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

const choices = BACKLOG_ACTIONS.map((action) => ({
  value: action,
  label: BACKLOG_ACTION_LABELS[action],
}))

/** One leftover task and what happens to it at clock-in. */
export function BacklogTaskChoice({ task, value, onChange }: BacklogTaskChoiceProps) {
  const due = task.dueDate ? dueFormat.format(new Date(task.dueDate)) : undefined
  const carried = task.rollovers > 0 ? `carried ${task.rollovers}×` : undefined

  return (
    <Fieldset variant="filled" p="sm" legend={task.name}>
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Text size="sm" c="dimmed">
          {[due && `Planned for ${due}`, carried].filter(Boolean).join(' · ')}
        </Text>
        <SegmentedControl size="md" data={choices} value={value} onChange={onChange} />
      </Group>
    </Fieldset>
  )
}
