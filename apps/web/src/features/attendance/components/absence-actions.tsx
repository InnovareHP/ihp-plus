'use client'

import { Button } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { offerUndo } from '@/lib/undo'
import { editAbsences, restoreLogs } from '../hooks/use-attendance-cache'
import { useGrantDayOff, useRevokeDayOff } from '../hooks/use-day-off'
import type { AttendanceAbsenceRow } from '../schema'

export interface AbsenceActionsProps {
  absence: AttendanceAbsenceRow
}

/** Excuses a missed day, or takes back a day off an admin gave; request leave has no action. */
export function AbsenceActions({ absence }: AbsenceActionsProps) {
  const grant = useGrantDayOff()
  const revoke = useRevokeDayOff()
  const queryClient = useQueryClient()
  const target = { userId: absence.userId, workDate: absence.workDate }
  const name = `${absence.userName} on ${absence.workDate}`

  async function takeBack() {
    // Undo over confirm: the row reads absent at once, and the server is told when the toast closes.
    const previous = await editAbsences(queryClient, (rows) =>
      rows.map((row) =>
        row.userId === absence.userId && row.workDate === absence.workDate
          ? { ...row, kind: 'absent' as const, leaveName: undefined, granted: false }
          : row,
      ),
    )

    offerUndo({
      message: `Took back ${absence.userName}'s day off`,
      undoLabel: 'Undo',
      onUndo: () => restoreLogs(queryClient, previous),
      onCommit: () => revoke.mutate(target),
    })
  }

  if (absence.kind === 'absent') {
    return (
      <Button
        variant="light"
        onClick={() => grant.mutate(target)}
        aria-label={`Grant day off to ${name}`}
      >
        Grant day off
      </Button>
    )
  }

  if (!absence.granted) return null

  return (
    <Button
      variant="subtle"
      color="gray"
      onClick={() => void takeBack()}
      aria-label={`Take back the day off for ${name}`}
    >
      Take back
    </Button>
  )
}
