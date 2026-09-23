import { Badge, Group, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import type { ReactNode } from 'react'

export type StepState = 'done' | 'todo' | 'waiting'

const BADGES: Record<StepState, { label: string; color: string }> = {
  done: { label: 'Done', color: 'green' },
  todo: { label: 'To do', color: 'brand' },
  waiting: { label: 'Waiting on People & Culture', color: 'gray' },
}

export interface ChecklistStepProps {
  number: number
  title: string
  state: StepState
  /** One sentence on where this step stands. */
  detail: string
  children?: ReactNode
}

/** One numbered step on a new hire's checklist; the badge carries the state, not colour alone. */
export function ChecklistStep({ number, title, state, detail, children }: ChecklistStepProps) {
  const badge = BADGES[state]

  return (
    <Group component="li" align="flex-start" wrap="nowrap" gap="md">
      <ThemeIcon
        size={32}
        radius="xl"
        variant={state === 'done' ? 'filled' : 'light'}
        color={state === 'done' ? 'green' : 'brand'}
        aria-hidden
      >
        {state === 'done' ? <IconCheck size={18} /> : <Text fw={700}>{number}</Text>}
      </ThemeIcon>
      <Stack gap="xs" flex={1} miw={0}>
        <Group gap="xs" wrap="wrap">
          <Text fw={600}>{title}</Text>
          <Badge variant="light" color={badge.color}>
            {badge.label}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {detail}
        </Text>
        {children}
      </Stack>
    </Group>
  )
}
