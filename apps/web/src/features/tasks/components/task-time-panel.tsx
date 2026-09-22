'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconPlayerPlay, IconPlayerStop, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  useDeleteTimeEntry,
  useLogTime,
  useRunningTimer,
  useStartTimer,
  useStopTimer,
  useTimeLog,
  useTimeSettings,
} from '../hooks/use-time'
import type { TaskRow, TaskTimeEntryRow } from '../schema'
import { elapsedSince, formatClock, formatDuration, parseDuration } from '../utils/duration'

const stamp = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const day = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

const manualSchema = z.object({
  duration: z
    .string()
    .trim()
    .min(1, 'Say how long it took.')
    .refine((value) => parseDuration(value) !== undefined, 'Try 45m, 1h 30m or 1.5h.'),
  spentOn: z.string().trim().default(''),
  note: z.string().trim().max(200, 'Keep the note under 200 characters.').default(''),
})

type ManualValues = z.infer<typeof manualSchema>

export interface TaskTimePanelProps {
  task: TaskRow
  viewerId: string
}

/** A ticking clock is the one place a second-by-second render earns itself. */
function useTick(active: boolean) {
  const [, setNow] = useState(0)

  useEffect(() => {
    if (!active) return
    // Synchronises with the wall clock, which React has no way to observe.
    const id = window.setInterval(() => setNow((count) => count + 1), 1000)
    return () => window.clearInterval(id)
  }, [active])
}

export function TaskTimePanel({ task, viewerId }: TaskTimePanelProps) {
  const settings = useTimeSettings()
  const log = useTimeLog(task.id)
  const running = useRunningTimer()

  const start = useStartTimer()
  const stop = useStopTimer()
  const add = useLogTime()
  const remove = useDeleteTimeEntry()

  const rules = settings.data?.settings
  const isAdmin = settings.data?.canManage ?? false
  const runningHere = running.data?.entry.taskId === task.id ? running.data : undefined

  useTick(Boolean(runningHere))

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof manualSchema>, unknown, ManualValues>({
    resolver: zodResolver(manualSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { duration: '', spentOn: '', note: '' },
  })

  async function submit(values: ManualValues) {
    const seconds = parseDuration(values.duration)
    if (seconds === undefined) return

    try {
      await add.mutateAsync({
        taskId: task.id,
        seconds,
        spentOn: values.spentOn,
        note: values.note,
      })
      reset({ duration: '', spentOn: '', note: '' })
    } catch (error) {
      setError('duration', {
        message: error instanceof Error ? error.message : 'Could not log that time.',
      })
    }
  }

  function mayRemove(entry: TaskTimeEntryRow) {
    if (isAdmin) return true
    return entry.userId === viewerId && (rules?.allowSelfEdit ?? true)
  }

  const total = log.data?.totalSeconds ?? 0
  const live = runningHere ? elapsedSince(runningHere.entry.startedAt) : 0

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Stack gap={0}>
          <Text size="sm" c="dimmed">
            Time on this task
          </Text>
          <Title order={3} size="h4">
            {formatDuration(total + live)}
          </Title>
        </Stack>

        {runningHere ? (
          <Group gap="sm" wrap="nowrap">
            <Text size="sm" ff="monospace" aria-live="off">
              {formatClock(live)}
            </Text>
            <Button
              color="red"
              leftSection={<IconPlayerStop size={16} aria-hidden />}
              loading={stop.isPending}
              onClick={() => stop.mutate({})}
            >
              Stop timer
            </Button>
          </Group>
        ) : (
          <Button
            leftSection={<IconPlayerPlay size={16} aria-hidden />}
            loading={start.isPending}
            onClick={() => start.mutate({ taskId: task.id })}
          >
            Start timer
          </Button>
        )}
      </Group>

      {running.data && !runningHere ? (
        <Alert color="blue" variant="light">
          Your timer is running on #{running.data.taskNumber} {running.data.taskName}. Starting one
          here stops that one.
        </Alert>
      ) : null}

      {rules?.allowManualEntry === false ? (
        <Text size="sm" c="dimmed">
          Your organization records time with the timer only.
        </Text>
      ) : (
        <form onSubmit={handleSubmit(submit)} noValidate>
          <Stack gap="sm">
            {/* Every field in the row carries one line of description, so the inputs line up. */}
            <Group align="flex-start" gap="sm" wrap="wrap">
              <TextInput
                {...register('duration')}
                label="Log time"
                placeholder="1h 30m"
                description="45m, 1h 30m or 1.5h."
                error={errors.duration?.message}
                errorProps={{ role: 'alert' }}
                w={{ base: '100%', xs: 160 }}
              />
              <TextInput
                {...register('spentOn')}
                type="date"
                label="Day"
                description="Defaults to today."
                error={errors.spentOn?.message}
                errorProps={{ role: 'alert' }}
                w={{ base: '100%', xs: 170 }}
              />
              <TextInput
                {...register('note')}
                label="Note"
                placeholder={rules?.requireNote ? 'What the time went on' : 'Optional'}
                description={rules?.requireNote ? 'Required here.' : 'Optional.'}
                required={rules?.requireNote}
                aria-required={rules?.requireNote ? 'true' : undefined}
                error={errors.note?.message}
                errorProps={{ role: 'alert' }}
                flex={1}
                miw={160}
              />
            </Group>

            <Group justify="flex-end">
              <Button type="submit" variant="default" loading={isSubmitting || add.isPending}>
                Add
              </Button>
            </Group>
          </Stack>
        </form>
      )}

      {log.isPending ? (
        <Stack gap="xs" aria-busy="true">
          <Skeleton height={48} radius="md" />
          <Skeleton height={48} radius="md" />
        </Stack>
      ) : log.data && log.data.entries.length === 0 ? (
        <Text size="sm" c="dimmed">
          No hours on this task yet. Start the timer, or write up time already spent.
        </Text>
      ) : (
        <Stack component="ul" gap="xs" p={0} style={{ listStyle: 'none' }}>
          {(log.data?.entries ?? []).map((entry) => (
            <Paper key={entry.id} component="li" withBorder radius="md" p="sm">
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Group gap="xs" wrap="wrap">
                    <Text size="sm" fw={600}>
                      {entry.isRunning ? 'Running' : formatDuration(entry.seconds)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {entry.userId === viewerId ? 'You' : entry.userName} ·{' '}
                      {entry.endedAt
                        ? day.format(new Date(entry.startedAt))
                        : stamp.format(new Date(entry.startedAt))}
                    </Text>
                  </Group>
                  {entry.note ? (
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {entry.note}
                    </Text>
                  ) : null}
                </Stack>

                {mayRemove(entry) && !entry.isRunning ? (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Delete ${formatDuration(entry.seconds)} logged by ${
                      entry.userId === viewerId ? 'you' : entry.userName
                    }`}
                    loading={remove.isPending}
                    onClick={() => remove.mutate({ entryId: entry.id })}
                  >
                    <IconTrash size={16} aria-hidden />
                  </ActionIcon>
                ) : null}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
