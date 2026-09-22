'use client'

import { useQuery } from '@tanstack/react-query'
import { attendanceEvents } from '../events'
import { attendanceKeys } from '../query-keys'
import {
  approveAttendanceDay,
  deleteAttendanceDay,
  deleteSchedule,
  getAttendanceBoard,
  listSchedules,
  saveAttendanceDay,
  saveSchedule,
} from '../rpc'
import type { AttendanceDayValues, ScheduleValues } from '../schema'
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

export function useSaveAttendanceDay() {
  return useAttendanceMutation({
    mutationFn: (values: AttendanceDayValues) => saveAttendanceDay(values),
    successEvent: attendanceEvents.dayEdited,
    failureEvent: attendanceEvents.dayEditFailed,
  })
}

export function useApproveAttendanceDay() {
  return useAttendanceMutation({
    mutationFn: ({ dayId, approved }: { dayId: string; approved: boolean }) =>
      approveAttendanceDay(dayId, approved),
    successEvent: attendanceEvents.dayApproved,
    failureEvent: attendanceEvents.dayApproveFailed,
  })
}

export function useDeleteAttendanceDay() {
  return useAttendanceMutation({
    mutationFn: ({ dayId }: { dayId: string }) => deleteAttendanceDay(dayId),
    successEvent: attendanceEvents.dayDeleted,
    failureEvent: attendanceEvents.dayDeleteFailed,
  })
}

export function useSaveSchedule() {
  return useAttendanceMutation({
    mutationFn: (values: ScheduleValues) => saveSchedule(values),
    successEvent: attendanceEvents.scheduleSaved,
    failureEvent: attendanceEvents.scheduleSaveFailed,
  })
}

export function useClearSchedule() {
  return useAttendanceMutation({
    mutationFn: ({ userId }: { userId: string }) => deleteSchedule(userId),
    successEvent: attendanceEvents.scheduleCleared,
    failureEvent: attendanceEvents.scheduleClearFailed,
  })
}
