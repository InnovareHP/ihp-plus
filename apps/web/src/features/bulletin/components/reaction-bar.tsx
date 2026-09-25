'use client'

import { ActionIcon, Button, Group, Menu, Text } from '@mantine/core'
import { IconMoodPlus } from '@tabler/icons-react'
import {
  BULLETIN_REACTION_LABELS,
  BULLETIN_REACTIONS,
  isBulletinReaction,
  type ReactionSummaryRow,
} from '../schema'

export interface ReactionBarProps {
  reactions: readonly ReactionSummaryRow[]
  onToggle: (emoji: string) => void
  /** An optimistic post has no id the server knows yet. */
  disabled?: boolean
}

function labelFor(emoji: string) {
  return isBulletinReaction(emoji) ? BULLETIN_REACTION_LABELS[emoji] : emoji
}

export function ReactionBar({ reactions, onToggle, disabled }: ReactionBarProps) {
  return (
    <Group gap={6} wrap="wrap">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          size="compact-sm"
          radius="xl"
          variant={reaction.reactedByMe ? 'light' : 'default'}
          aria-pressed={reaction.reactedByMe}
          aria-label={`${labelFor(reaction.emoji)}: ${reaction.count}${reaction.reactedByMe ? ', including you' : ''}`}
          disabled={disabled}
          onClick={() => onToggle(reaction.emoji)}
        >
          <span aria-hidden>{reaction.emoji}</span>
          <Text span size="sm" ml={6} aria-hidden>
            {reaction.count}
          </Text>
        </Button>
      ))}

      <Menu position="bottom-start" withinPortal>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            radius="xl"
            size="lg"
            aria-label="Add a reaction"
            disabled={disabled}
          >
            <IconMoodPlus size={18} aria-hidden />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Group gap={2} p={4} wrap="nowrap">
            {BULLETIN_REACTIONS.map((emoji) => (
              <Menu.Item
                key={emoji}
                w="auto"
                px="xs"
                aria-label={BULLETIN_REACTION_LABELS[emoji]}
                onClick={() => onToggle(emoji)}
              >
                <span aria-hidden>{emoji}</span>
              </Menu.Item>
            ))}
          </Group>
        </Menu.Dropdown>
      </Menu>
    </Group>
  )
}
