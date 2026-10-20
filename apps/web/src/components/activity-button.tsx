'use client'

import { Divider, Popover, Stack, UnstyledButton, VisuallyHidden } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useId, useState } from 'react'
import { ClockActivity } from '@/features/attendance/components/clock-activity'
import { ClockOutModal } from '@/features/attendance/components/clock-out-modal'
import { useNow } from '@/features/attendance/hooks/use-now'
import { useTimeClock } from '@/features/attendance/hooks/use-time-clock'
import { liveWorkedSeconds, runningBreakStartedAt } from '@/features/attendance/utils/day'
import { TimerActivity } from '@/features/tasks/components/timer-activity'
import { useRunningTimer, useStopTimer } from '@/features/tasks/hooks/use-time'
import { elapsedSince, formatClock } from '@/features/tasks/utils/duration'
import { routes } from '@/lib/routes'
import classes from './activity-button.module.css'
import touch from './touch-target.module.css'

function shortClock(seconds: number) {
  const minutes = Math.max(Math.floor(seconds / 60), 0)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * The work day and a task timer share one quiet header button, and stopping either takes a
 * second tap so a stray touch never ends the day.
 */
export function ActivityButton() {
  const clock = useTimeClock()
  const running = useRunningTimer()
  const stop = useStopTimer()
  const [opened, { toggle, close }] = useDisclosure(false)
  const [confirming, setConfirming] = useState(false)
  const titleId = useId()
  const today = clock.data?.today?.isOpen ? clock.data.today : undefined
  const timer = running.data ?? undefined
  const now = useNow(Boolean(today || timer))

  if (!today && !timer) return null

  const timerElapsed = timer ? formatClock(elapsedSince(timer.entry.startedAt, new Date(now))) : ''
  const status = today ? (today.onBreak ? 'On break' : 'On the clock') : 'Task timer running'
  const state = today ? (today.onBreak ? 'break' : 'clock') : 'timer'
  const breakStart = today ? runningBreakStartedAt(today) : undefined
  // Hours and minutes only: a ticking seconds counter was the noisiest thing in the header.
  const label =
    state === 'break' && breakStart
      ? `Break ${shortClock((now - breakStart) / 1000)}`
      : shortClock(
          today
            ? liveWorkedSeconds(today, now)
            : elapsedSince(timer?.entry.startedAt ?? '', new Date(now)),
        )

  return (
    <>
      <Popover
        opened={opened}
        onDismiss={close}
        position="bottom-end"
        width={280}
        shadow="md"
        trapFocus
        returnFocus
        withinPortal
      >
        <Popover.Target>
          <UnstyledButton className={`${touch.target} ${classes.button}`} onClick={toggle}>
            <span className={classes.pill} data-state={state}>
              <span className={classes.dot} aria-hidden />
              <VisuallyHidden>{`${status} `}</VisuallyHidden>
              <span className={classes.time}>{label}</span>
              {today && timer ? (
                <>
                  <span className={classes.more} aria-hidden>
                    +1
                  </span>
                  <VisuallyHidden>, and a task timer</VisuallyHidden>
                </>
              ) : null}
            </span>
          </UnstyledButton>
        </Popover.Target>
        {/* Mantine names the panel after its trigger, whose ticking time would make a poor title. */}
        <Popover.Dropdown aria-labelledby={titleId}>
          <VisuallyHidden id={titleId}>Time tracking</VisuallyHidden>
          <Stack gap="sm">
            {today && clock.data ? (
              <ClockActivity
                day={today}
                now={now}
                timeZone={clock.data.settings.timeZone}
                onNavigate={close}
                onClockOut={() => {
                  close()
                  setConfirming(true)
                }}
              />
            ) : null}
            {today && timer ? <Divider /> : null}
            {timer ? (
              <TimerActivity
                taskName={timer.taskName}
                taskNumber={timer.taskNumber}
                href={`${routes.tasks}?project=${timer.projectId}&task=${timer.entry.taskId}&tab=time`}
                elapsed={timerElapsed}
                isStopping={stop.isPending}
                onNavigate={close}
                onStop={() => stop.mutate({})}
              />
            ) : null}
          </Stack>
        </Popover.Dropdown>
      </Popover>

      {confirming && today && clock.data ? (
        <ClockOutModal
          opened
          onClose={() => setConfirming(false)}
          day={today}
          settings={clock.data.settings}
          shift={clock.data.shift}
        />
      ) : null}
    </>
  )
}
