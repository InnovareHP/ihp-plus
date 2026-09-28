'use client'

import { formatTimeOfDay, shiftDateKey, workDateKey } from '@ihp/clock'
import { Button, Chip, Group, Loader, Stack, Text } from '@mantine/core'
import { IconCalendarSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { useSlotSuggestions } from '../hooks/use-interviews'
import { formatInterviewTime } from '../utils/interview-time'

export interface FreeTimeSuggestionsProps {
  interviewerIds: readonly string[]
  durationMinutes: number
  timeZone: string
  /** Wall clock in the organization's zone, the same shape the time rows take. */
  onPick: (slot: { date: string; time: string }) => void
}

const RANGE_DAYS = 14

// Reads the interviewers' Outlook calendars on request, never on every keystroke of the form.
export function FreeTimeSuggestions({
  interviewerIds,
  durationMinutes,
  timeZone,
  onPick,
}: FreeTimeSuggestionsProps) {
  // Ephemeral: which window was asked for, set by the click that asks.
  const [range, setRange] = useState<{ fromDate: string; toDate: string } | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const suggestions = useSlotSuggestions(
    {
      interviewerIds,
      durationMinutes,
      fromDate: range?.fromDate ?? '',
      toDate: range?.toDate ?? '',
    },
    range !== null,
  )

  function look() {
    const today = workDateKey(new Date(), timeZone)
    setRange({ fromDate: today, toDate: shiftDateKey(today, RANGE_DAYS) })
  }

  function pick(start: string) {
    const at = new Date(start)
    onPick({ date: workDateKey(at, timeZone), time: formatTimeOfDay(at, timeZone) })
    setPicked((current) => [...current, start])
  }

  if (interviewerIds.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        Pick the interviewers and their free times can be read from Outlook.
      </Text>
    )
  }

  return (
    <Stack gap="xs">
      <Button
        variant="light"
        size="compact-sm"
        w="fit-content"
        leftSection={<IconCalendarSearch size={14} aria-hidden />}
        onClick={look}
      >
        Find times everyone is free
      </Button>

      {suggestions.isFetching ? (
        <Group gap="xs" aria-live="polite">
          <Loader size="xs" aria-hidden />
          <Text size="xs">Reading calendars…</Text>
        </Group>
      ) : null}

      {suggestions.isError ? (
        <Text size="xs" c="red" role="alert">
          {suggestions.error.message}
        </Text>
      ) : null}

      {suggestions.data && !suggestions.isFetching ? (
        !suggestions.data.fromCalendar ? (
          <Text size="xs" c="dimmed">
            Outlook calendars are not connected yet, so type the times in below.
          </Text>
        ) : suggestions.data.starts.length === 0 ? (
          <Text size="xs" c="dimmed" aria-live="polite">
            Nobody is free together in the next two weeks during working hours.
          </Text>
        ) : (
          <Stack gap={4}>
            <Text size="xs" c="dimmed" aria-live="polite">
              Free for everyone — pick any to add it to the times below.
            </Text>
            <Group gap="xs">
              {suggestions.data.starts.map((start) => (
                <Chip
                  key={start}
                  size="xs"
                  checked={picked.includes(start)}
                  disabled={picked.includes(start)}
                  onChange={() => pick(start)}
                >
                  {formatInterviewTime(start, timeZone).replace(` (${timeZone})`, '')}
                </Chip>
              ))}
            </Group>
          </Stack>
        )
      ) : null}
    </Stack>
  )
}
