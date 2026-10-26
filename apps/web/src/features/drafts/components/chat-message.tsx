import { Paper, Text } from '@mantine/core'
import type { ChatMessage as Message } from '../schema'

export interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const mine = message.role === 'user'

  return (
    <Paper
      component="li"
      p="sm"
      radius="md"
      maw="85%"
      ml={mine ? 'auto' : 0}
      bg={mine ? 'var(--mantine-color-brand-light)' : 'var(--mantine-color-default-hover)'}
    >
      <Text size="xs" fw={600} c="dimmed">
        {mine ? 'You' : 'Assistant'}
      </Text>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {message.content}
      </Text>
    </Paper>
  )
}
