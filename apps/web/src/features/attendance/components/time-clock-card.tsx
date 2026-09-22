'use client'

import { Alert, Button, Card, Group, Skeleton, Stack, Text, Textarea, Title } from '@mantine/core'
import { IconCoffee, IconPlayerStop, IconPlayerPlay } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  useClockIn,
  useClockOut,
  useEndBreak,
  useStartBreak,
  useTimeClock,
} from '../hooks/use-time-clock'
import { useNow } from '../hooks/use-now'
import type { AttendanceSettingsRow } from '../schema'
import { formatHours, minutesToClock } from '../utils/clock'
import { dayState, liveBreakSeconds, liveWorkedSeconds } from '../utils/day'
import { currentLocation } from '../utils/location'
import { ClockReading } from './clock-reading'
import { ClockStateBadge } from './clock-state-badge'
import { DayTotals } from './day-totals'
import { SelfieCapture } from './selfie-capture'

type Punch = 'in' | 'out'

interface NoteForm {
  note: string
}

/** The screen a member uses every day: one big clock and one obvious next action. */
export function TimeClockCard() {
  const clock = useTimeClock()
  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const startBreak = useStartBreak()
  const endBreak = useEndBreak()
  const [selfieFor, setSelfieFor] = useState<Punch | undefined>(undefined)

  const {
    register,
    getValues,
    reset,
    formState: { errors },
    setError,
  } = useForm<NoteForm>({ defaultValues: { note: '' } })

  const today = clock.data?.today
  const state = dayState(today)
  const now = useNow(state === 'in' || state === 'break')

  if (clock.isPending) {
    return (
      <Card padding="lg" aria-busy="true">
        <Stack gap="md">
          <Skeleton height={28} width={180} />
          <Skeleton height={56} />
          <Skeleton height={40} />
        </Stack>
      </Card>
    )
  }

  if (clock.isError || !clock.data) {
    return (
      <Alert color="red" title="Could not open your time clock" role="alert">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">Check your connection and try again.</Text>
          <Button onClick={() => void clock.refetch()}>Try again</Button>
        </Stack>
      </Alert>
    )
  }

  const { settings, schedule } = clock.data
  const isBusy =
    clockIn.isPending || clockOut.isPending || startBreak.isPending || endBreak.isPending

  async function punch(which: Punch, selfieKey: string) {
    const note = getValues('note').trim()
    if (which === 'out' && settings.requireNote && !note) {
      setError('note', { message: 'Say what you worked on before clocking out.' })
      return
    }

    const location = settings.captureLocation ? await currentLocation() : ''
    const values = { selfieKey, location, note }

    try {
      if (which === 'in') await clockIn.mutateAsync(values)
      else await clockOut.mutateAsync(values)
      reset({ note: '' })
      setSelfieFor(undefined)
    } catch {
      // The mutation announces the reason; the buttons stay where they were.
      setSelfieFor(undefined)
    }
  }

  function press(which: Punch) {
    if (settings.requireSelfie) {
      setSelfieFor(which)
      return
    }
    void punch(which, '')
  }

  return (
    <Card padding="lg" component="section" aria-labelledby="time-clock-heading">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Title order={2} size="h5" id="time-clock-heading">
              Your time clock
            </Title>
            <Text size="sm" c="dimmed">
              {shiftLine(settings, schedule.shiftStartMinutes, schedule.shiftEndMinutes)}
            </Text>
          </Stack>
          <ClockStateBadge state={state} />
        </Group>

        <ClockReading day={today} now={now} state={state} timeZone={settings.timeZone} />

        {today ? (
          <DayTotals
            workedSeconds={liveWorkedSeconds(today, now)}
            breakSeconds={today.isOpen ? liveBreakSeconds(today, now) : today.breakSeconds}
            lateSeconds={today.lateSeconds}
          />
        ) : null}

        {selfieFor ? (
          <SelfieCapture
            purpose={selfieFor === 'in' ? 'clock in' : 'clock out'}
            onCaptured={(key) => void punch(selfieFor, key)}
            onCancel={() => setSelfieFor(undefined)}
          />
        ) : null}

        {state !== 'absent' && today?.isOpen ? (
          <Textarea
            label="What are you working on today?"
            description={settings.requireNote ? undefined : 'Optional — it lands on today’s row.'}
            required={settings.requireNote}
            aria-required={settings.requireNote}
            error={errors.note?.message}
            errorProps={{ role: 'alert' }}
            autosize
            minRows={2}
            {...register('note')}
          />
        ) : null}

        <Group gap="sm">
          {state === 'absent' ? (
            <Button
              leftSection={<IconPlayerPlay size={18} />}
              onClick={() => press('in')}
              loading={clockIn.isPending}
              disabled={isBusy}
              size="md"
            >
              {clockIn.isPending ? 'Clocking in…' : 'Clock in'}
            </Button>
          ) : null}

          {state === 'in' ? (
            <>
              <Button
                variant="default"
                leftSection={<IconCoffee size={18} />}
                onClick={() => startBreak.mutate(undefined)}
                loading={startBreak.isPending}
                disabled={isBusy}
                size="md"
              >
                Start break
              </Button>
              <Button
                leftSection={<IconPlayerStop size={18} />}
                onClick={() => press('out')}
                loading={clockOut.isPending}
                disabled={isBusy}
                size="md"
              >
                {clockOut.isPending ? 'Clocking out…' : 'Clock out'}
              </Button>
            </>
          ) : null}

          {state === 'break' ? (
            <Button
              onClick={() => endBreak.mutate(undefined)}
              loading={endBreak.isPending}
              disabled={isBusy}
              size="md"
            >
              End break
            </Button>
          ) : null}

          {state === 'out' && today ? (
            <Text size="sm" c="dimmed">
              Today is recorded — {formatHours(today.workedSeconds)} worked. Your admin can correct
              it if something is off.
            </Text>
          ) : null}
        </Group>
      </Stack>
    </Card>
  )
}

function shiftLine(settings: AttendanceSettingsRow, startMinutes: number, endMinutes: number) {
  const shift = `${minutesToClock(startMinutes)}–${minutesToClock(endMinutes)}`
  return `Your shift is ${shift} (${settings.timeZone}), with ${settings.graceMinutes} minutes' grace.`
}
