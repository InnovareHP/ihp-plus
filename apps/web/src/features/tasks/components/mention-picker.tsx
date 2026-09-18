'use client'

import { Button, Group, Menu, Text } from '@mantine/core'
import { IconAt } from '@tabler/icons-react'
import type { TaskAssigneeRef } from '../schema'

export interface MentionPickerProps {
  colleagues: readonly TaskAssigneeRef[]
  onPick: (person: TaskAssigneeRef) => void
}

/**
 * A menu rather than an inline autocomplete on "@": the picker keeps the id it resolved, and a
 * caret-position popup is the part of a mention editor that never works with a screen reader.
 */
export function MentionPicker({ colleagues, onPick }: MentionPickerProps) {
  if (colleagues.length === 0) return null

  return (
    <Group gap="xs" align="center">
      <Menu position="bottom-start" withinPortal>
        <Menu.Target>
          <Button
            type="button"
            variant="subtle"
            size="compact-sm"
            leftSection={<IconAt size={14} aria-hidden />}
          >
            Mention someone
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>They get an email</Menu.Label>
          {colleagues.map((person) => (
            <Menu.Item key={person.userId} onClick={() => onPick(person)}>
              {person.name}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      <Text size="xs" c="dimmed">
        Deleting the @name before posting takes them off it.
      </Text>
    </Group>
  )
}
