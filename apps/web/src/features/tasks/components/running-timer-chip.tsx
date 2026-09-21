'use client'

import { ActionIcon, Button, Group, Paper, Text } from '@mantine/core'
import { IconPlayerStop } from '@tabler/icons-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { routes } from '@/lib/routes'
import { useRunningTimer, useStopTimer } from '../hooks/use-time'
import { elapsedSince, formatClock } from '../utils/duration'

/**
 * A clock left running is the failure mode of every time tracker, so it follows the person
 * around the app rather than hiding in the task they started it on.
 */
export function RunningTimerChip() {
  const running = useRunningTimer()
  const stop = useStopTimer()
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!running.data) return
    // Synchronises with the wall clock, which React cannot observe on its own.
    const id = window.setInterval(() => setTick((count) => count + 1), 1000)
    return () => window.clearInterval(id)
  }, [running.data])

  if (!running.data) return null

  const { entry, taskName, taskNumber, projectId } = running.data
  const elapsed = elapsedSince(entry.startedAt)

  return (
    <Paper withBorder radius="xl" px="xs" py={4} visibleFrom="xs">
      <Group gap="xs" wrap="nowrap">
        <Text
          component={Link}
          href={`${routes.tasks}?project=${projectId}&task=${entry.taskId}&tab=time`}
          size="sm"
          fw={500}
          lineClamp={1}
          maw={180}
          // The task is the point of the chip; the clock beside it is the detail.
          title={`#${taskNumber} ${taskName}`}
        >
          {taskName}
        </Text>
        <Text size="sm" ff="monospace" c="dimmed">
          {formatClock(elapsed)}
        </Text>
        <ActionIcon
          variant="subtle"
          color="red"
          aria-label={`Stop the timer on ${taskName}`}
          loading={stop.isPending}
          onClick={() => stop.mutate({})}
        >
          <IconPlayerStop size={16} aria-hidden />
        </ActionIcon>
      </Group>
    </Paper>
  )
}

/** The same thing where there is no room for it: one button that stops the clock. */
export function RunningTimerButton() {
  const running = useRunningTimer()
  const stop = useStopTimer()

  if (!running.data) return null

  return (
    <Button
      hiddenFrom="xs"
      size="compact-sm"
      color="red"
      variant="light"
      loading={stop.isPending}
      onClick={() => stop.mutate({})}
    >
      Stop timer
    </Button>
  )
}
