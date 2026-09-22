'use client'

import { useQuery } from '@tanstack/react-query'
import { attendanceEvents } from '../events'
import {
  assignShift,
  deleteAttendanceDay,
  deleteShift,
  getAttendanceBoard,
  listSchedules,
  listShifts,
  saveAttendanceDay,
  saveShift,
} from '../rpc'
import { attendanceKeys } from '../query-keys'
import type { AssignShiftValues, AttendanceDayValues, ShiftValues } from '../schema'
import { useAttendanceMutation } from './use-time-clock'

/** Who is in right now, so the board keeps up with a clock pressed on the floor. */
export function useAttendanceBoard(date: string) {
  return useQuery({
    queryKey: attendanceKeys.board(date),
    queryFn: () => getAttendanceBoard(date),
    refetchInterval: 60 * 1000,
    staleTime: 15 * 1000,
  })
}

export function useSchedules() {
  return useQuery({ queryKey: attendanceKeys.schedules(), queryFn: listSchedules })
}

export function useShifts() {
  return useQuery({ queryKey: attendanceKeys.shifts(), queryFn: listShifts })
}

// Not optimistic: a correction is re-measured server-side — worked hours, lateness and whether
// the day is still running all come back changed.
export function useSaveAttendanceDay() {
  return useAttendanceMutation({
    mutationFn: (values: AttendanceDayValues) => saveAttendanceDay(values),
    successEvent: attendanceEvents.dayEdited,
    failureEvent: attendanceEvents.dayEditFailed,
  })
}

export function useDeleteAttendanceDay() {
  return useAttendanceMutation({
    mutationFn: ({ dayId }: { dayId: string }) => deleteAttendanceDay(dayId),
    successEvent: attendanceEvents.dayDeleted,
    failureEvent: attendanceEvents.dayDeleteFailed,
  })
}

export function useSaveShift() {
  return useAttendanceMutation({
    mutationFn: (values: ShiftValues) => saveShift(values),
    successEvent: attendanceEvents.shiftSaved,
    failureEvent: attendanceEvents.shiftSaveFailed,
  })
}

export function useDeleteShift() {
  return useAttendanceMutation({
    mutationFn: ({ shiftId }: { shiftId: string }) => deleteShift(shiftId),
    successEvent: attendanceEvents.shiftDeleted,
    failureEvent: attendanceEvents.shiftDeleteFailed,
  })
}

/** Assigning is done under the organization, where the rest of a person's record is set. */
export function useAssignShift() {
  return useAttendanceMutation({
    mutationFn: (values: AssignShiftValues) => assignShift(values),
    successEvent: attendanceEvents.shiftAssigned,
    failureEvent: attendanceEvents.shiftAssignFailed,
  })
}
