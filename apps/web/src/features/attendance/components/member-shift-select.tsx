'use client'

import { Select } from '@mantine/core'
import { useAssignShift, useSchedules } from '../hooks/use-attendance-admin'
import { minutesToClock } from '@ihp/clock'

export interface MemberShiftSelectProps {
  userId: string
  /** Named in the control's accessible name, since the row header is a cell away. */
  userName: string
  /** A visible label, for a form rather than a table cell; the control then fills its row. */
  label?: string
}

/** Company hours, which is what anybody without a shift of their own works. */
const COMPANY_HOURS = ''

/** The shift a person works, set where the rest of their record is — the members table. */
export function MemberShiftSelect({ userId, userName, label }: MemberShiftSelectProps) {
  const book = useSchedules()
  const assign = useAssignShift()

  const options = [
    { value: COMPANY_HOURS, label: 'Company hours' },
    ...(book.data?.shifts ?? []).map((shift) => ({
      value: shift.id,
      label: `${shift.name} · ${minutesToClock(shift.shiftStartMinutes)}–${minutesToClock(shift.shiftEndMinutes)}`,
    })),
  ]

  const assigned = book.data?.schedules.find((row) => row.userId === userId)

  return (
    <Select
      label={label}
      aria-label={label ? undefined : `Shift for ${userName}`}
      data={options}
      value={assigned?.shiftId ?? COMPANY_HOURS}
      allowDeselect={false}
      disabled={book.isPending}
      size="sm"
      w={label ? '100%' : 180}
      comboboxProps={{ withinPortal: true }}
      onChange={(value) => assign.mutate({ userId, shiftId: value ?? COMPANY_HOURS })}
    />
  )
}
