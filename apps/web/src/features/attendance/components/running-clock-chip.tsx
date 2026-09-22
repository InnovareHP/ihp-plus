'use client'

import { ActionIcon, Button, Group, Paper, Text } from '@mantine/core'
import { IconPlayerStop } from '@tabler/icons-react'
import Link from 'next/link'
import { useState } from 'react'
import { routes } from '@/lib/routes'
import { useNow } from '../hooks/use-now'
import { useTimeClock } from '../hooks/use-time-clock'
import { formatElapsed } from '../utils/clock'
import { liveWorkedSeconds } from '../utils/day'
import { ClockOutModal } from './clock-out-modal'

/**
 * A day left open is the failure mode of every time clock, so it follows the person around the
 * app rather than waiting on the page they started it from.
 */
export function RunningClockChip() {
  const clock = useTimeClock()
  const [confirming, setConfirming] = useState(false)
  const today = clock.data?.today
  const now = useNow(Boolean(today?.isOpen))

  if (!today?.isOpen || !clock.data) return null

  const onBreak = today.onBreak

  return (
    <>
      <Paper withBorder radius="xl" px="xs" py={4} visibleFrom="xs">
        <Group gap="xs" wrap="nowrap">
          <Text
            component={Link}
            href={routes.attendance}
            size="sm"
            fw={500}
            title={onBreak ? 'You are on a break' : 'You are on the clock'}
          >
            {onBreak ? 'On break' : 'On the clock'}
          </Text>
          <Text size="sm" ff="monospace" c="dimmed">
            {formatElapsed(liveWorkedSeconds(today, now))}
          </Text>
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label="Clock out"
            onClick={() => setConfirming(true)}
          >
            <IconPlayerStop size={16} aria-hidden />
          </ActionIcon>
        </Group>
      </Paper>

      {/* The same thing where there is no room for it: one button that ends the day. */}
      <Button
        hiddenFrom="xs"
        size="compact-sm"
        color="red"
        variant="light"
        onClick={() => setConfirming(true)}
      >
        Clock out
      </Button>

      {confirming ? (
        <ClockOutModal
          opened
          onClose={() => setConfirming(false)}
          day={today}
          settings={clock.data.settings}
        />
      ) : null}
    </>
  )
}
