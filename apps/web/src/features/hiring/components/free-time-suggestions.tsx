'use client'

import { Chip, Group, Loader, Stack, Text } from '@mantine/core'
import { useSlotSuggestions } from '../hooks/use-interviews'
import { formatInterviewTime, slotOf, suggestionWindow } from '../utils/interview-time'

export interface FreeTimeSuggestionsProps {
  interviewerIds: readonly string[]
  durationMinutes: number
  timeZone: string
  /** Rows already in the form, as "date time", so a chip shows it is taken. */
  chosen: readonly string[]
  /** Wall clock in the organization's zone, the same shape the time rows take. */
  onPick: (slot: { date: string; time: string }) => void
}

// Reads the interviewers' Outlook calendars as soon as they are picked.
export function FreeTimeSuggestions({
  interviewerIds,
  durationMinutes,
  timeZone,
  chosen,
  onPick,
}: FreeTimeSuggestionsProps) {
  const suggestions = useSlotSuggestions(
    { interviewerIds, durationMinutes, ...suggestionWindow(timeZone) },
    true,
  )

  if (interviewerIds.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        Pick the interviewers and the times they are all free fill in from Outlook.
      </Text>
    )
  }

  if (suggestions.isPending) {
    return (
      <Group gap="xs" aria-live="polite">
        <Loader size="xs" aria-hidden />
        <Text size="xs">Reading calendars…</Text>
      </Group>
    )
  }

  if (suggestions.isError) {
    return (
      <Text size="xs" c="red" role="alert">
        {suggestions.error.message} Type the times in below instead.
      </Text>
    )
  }

  if (!suggestions.data.fromCalendar) {
    return (
      <Text size="xs" c="dimmed">
        Outlook calendars are not connected, so type the times in below.
      </Text>
    )
  }

  if (suggestions.data.starts.length === 0) {
    return (
      <Text size="xs" c="dimmed" aria-live="polite">
        Nobody is free together in the next two weeks during working hours, so type a time in.
      </Text>
    )
  }

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed" aria-live="polite">
        Everyone is free at these times. Pick one to add it below.
      </Text>
      <Group gap="xs">
        {suggestions.data.starts.map((start) => {
          const slot = slotOf(start, timeZone)
          const taken = chosen.includes(`${slot.date} ${slot.time}`)
          return (
            <Chip
              key={start}
              size="xs"
              checked={taken}
              disabled={taken}
              onChange={() => onPick(slot)}
            >
              {formatInterviewTime(start, timeZone).replace(` (${timeZone})`, '')}
            </Chip>
          )
        })}
      </Group>
    </Stack>
  )
}
