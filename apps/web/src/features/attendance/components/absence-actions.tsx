'use client'

import { Menu } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { RowActionsMenu } from '@/components/row-actions-menu'
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
          ? { ...row, kind: 'absent' as const, leaveName: undefined, granted: false, paid: false }
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
      <RowActionsMenu name={name}>
        <Menu.Label>Grant day off</Menu.Label>
        <Menu.Item onClick={() => grant.mutate({ ...target, paid: true })}>Paid day off</Menu.Item>
        <Menu.Item onClick={() => grant.mutate({ ...target, paid: false })}>
          Unpaid day off
        </Menu.Item>
      </RowActionsMenu>
    )
  }

  if (!absence.granted) return null

  return (
    <RowActionsMenu name={name}>
      <Menu.Item color="red" onClick={() => void takeBack()}>
        Take back day off
      </Menu.Item>
    </RowActionsMenu>
  )
}
