'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { attendanceEvents } from '../events'
import { attendanceKeys } from '../query-keys'
import { grantDayOff, revokeDayOff } from '../rpc'
import {
  grantedDayOffName,
  type AttendanceAbsenceRow,
  type DayOffValues,
  type GrantDayOffValues,
} from '../schema'
import { editAbsences, restoreLogs, type LogSnapshot } from './use-attendance-cache'

function isDay(row: AttendanceAbsenceRow, values: DayOffValues) {
  return row.userId === values.userId && row.workDate === values.workDate
}

/** The row turns to leave the instant it is clicked, and back to absent if the server says no. */
export function useGrantDayOff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: GrantDayOffValues) => grantDayOff(values),
    onMutate: async (values) => ({
      previous: await editAbsences(queryClient, (rows) =>
        rows.map((row) =>
          isDay(row, values)
            ? {
                ...row,
                kind: 'leave' as const,
                leaveName: grantedDayOffName(values.paid),
                granted: true,
              }
            : row,
        ),
      ),
    }),
    onSuccess: (_data, values) => track(attendanceEvents.dayOffGranted, { paid: values.paid }),
    onError: (error: Error, _values, context: { previous: LogSnapshot } | undefined) => {
      restoreLogs(queryClient, context?.previous)
      track(attendanceEvents.dayOffGrantFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      // The board and both calendars count leave too.
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}

/** The caller has already drawn the row as absent behind an undo toast; this only commits it. */
export function useRevokeDayOff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: DayOffValues) => revokeDayOff(values),
    onSuccess: () => track(attendanceEvents.dayOffRevoked),
    onError: (error: Error) => {
      track(attendanceEvents.dayOffRevokeFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}
