'use client'

import { Button, Group } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { offerUndo } from '@/lib/undo'
import { useDeleteAttendanceDay } from '../hooks/use-attendance-admin'
import { editLogs, restoreLogs } from '../hooks/use-attendance-cache'
import type { AttendanceDayRow } from '../schema'

export interface AttendanceDayActionsProps {
  day: AttendanceDayRow
  onCorrect: (day: AttendanceDayRow) => void
}

/** Correct a day or take it out — the two things an admin does to a row. */
export function AttendanceDayActions({ day, onCorrect }: AttendanceDayActionsProps) {
  const remove = useDeleteAttendanceDay()
  const queryClient = useQueryClient()

  async function drop() {
    // Undo over confirm: the row goes at once, and the server is only told when the toast closes.
    const previous = await editLogs(queryClient, (days) => days.filter((row) => row.id !== day.id))

    offerUndo({
      message: `Removed ${day.userName}'s ${day.workDate}`,
      undoLabel: 'Undo',
      onUndo: () => restoreLogs(queryClient, previous),
      onCommit: () => remove.mutate({ dayId: day.id }),
    })
  }

  return (
    <Group gap="xs" justify="flex-end" wrap="nowrap">
      <Button
        variant="subtle"
        size="compact-sm"
        onClick={() => onCorrect(day)}
        aria-label={`Correct ${day.userName}'s ${day.workDate}`}
      >
        Correct
      </Button>
      <Button
        variant="subtle"
        color="red"
        size="compact-sm"
        onClick={() => void drop()}
        aria-label={`Remove ${day.userName}'s ${day.workDate}`}
      >
        Remove
      </Button>
    </Group>
  )
}
