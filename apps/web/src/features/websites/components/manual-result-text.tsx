import { Group, Text } from '@mantine/core'
import { IconCheck, IconX } from '@tabler/icons-react'
import { MANUAL_RESULT_LABELS, type ManualResult } from '../schema'

export interface ManualResultTextProps {
  result: ManualResult | undefined
}

export function ManualResultText({ result }: ManualResultTextProps) {
  if (!result) {
    return (
      <Text size="sm" c="dimmed">
        Not checked
      </Text>
    )
  }
  const Icon = result === 'pass' ? IconCheck : IconX
  return (
    <Group gap={4} wrap="nowrap">
      <Icon
        size={16}
        color={`var(--mantine-color-${result === 'pass' ? 'teal' : 'red'}-text)`}
        aria-hidden
      />
      <Text size="sm" fw={result === 'fail' ? 600 : 400}>
        {MANUAL_RESULT_LABELS[result]}
      </Text>
    </Group>
  )
}
