import { Anchor, Button, Group, Stack, Text } from '@mantine/core'
import { IconPlayerStop, IconStopwatch } from '@tabler/icons-react'
import Link from 'next/link'

export interface TimerActivityProps {
  taskName: string
  taskNumber: number
  href: string
  /** Already formatted, e.g. "0:12:03". */
  elapsed: string
  isStopping: boolean
  onStop: () => void
  onNavigate?: () => void
}

export function TimerActivity({
  taskName,
  taskNumber,
  href,
  elapsed,
  isStopping,
  onStop,
  onNavigate,
}: TimerActivityProps) {
  return (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap={6} wrap="nowrap">
          <IconStopwatch size={16} aria-hidden />
          <Text size="sm" fw={600}>
            Task timer
          </Text>
        </Group>
        <Text size="sm" ff="monospace" fw={500}>
          {elapsed}
        </Text>
      </Group>
      <Anchor component={Link} href={href} size="sm" lineClamp={2} onClick={onNavigate}>
        #{taskNumber} {taskName}
      </Anchor>
      <Group justify="flex-end" mt={4}>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconPlayerStop size={14} aria-hidden />}
          loading={isStopping}
          onClick={onStop}
        >
          Stop timer
        </Button>
      </Group>
    </Stack>
  )
}
