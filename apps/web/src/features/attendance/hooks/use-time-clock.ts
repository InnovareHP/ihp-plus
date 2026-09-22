'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track, type EventName } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { attendanceEvents } from '../events'
import { attendanceKeys } from '../query-keys'
import {
  clockIn,
  clockOut,
  endBreak,
  getAttendanceSettings,
  getTimeClock,
  listAttendance,
  startBreak,
  updateAttendanceSettings,
  type AttendanceRange,
} from '../rpc'
import type { AttendanceSettingsRow, ClockActionValues } from '../schema'

/**
 * The clock polls: the auto close an admin set is applied server-side on the way past, and a
 * second tab clocking out must not leave this one showing a running day.
 */
export function useTimeClock() {
  return useQuery({
    queryKey: attendanceKeys.clock(),
    queryFn: getTimeClock,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 15 * 1000,
  })
}

export function useAttendanceSettings() {
  return useQuery({
    queryKey: attendanceKeys.settings(),
    queryFn: getAttendanceSettings,
    // Rules change about as often as the company does.
    staleTime: 30 * 60 * 1000,
  })
}

export function useAttendanceLog(range: AttendanceRange) {
  return useQuery({
    queryKey: attendanceKeys.log(range),
    queryFn: () => listAttendance(range),
  })
}

/** Hours are counted, not guessed: every write refetches rather than patching a total by hand. */
export function useAttendanceMutation<TVariables, TResult>(options: {
  mutationFn: (variables: TVariables) => Promise<TResult>
  successEvent: EventName
  failureEvent: EventName
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: () => track(options.successEvent),
    onError: (error: Error) => {
      track(options.failureEvent, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}

export function useClockIn() {
  return useAttendanceMutation({
    mutationFn: (values: ClockActionValues) => clockIn(values),
    successEvent: attendanceEvents.clockedIn,
    failureEvent: attendanceEvents.clockInFailed,
  })
}

export function useClockOut() {
  return useAttendanceMutation({
    mutationFn: (values: ClockActionValues) => clockOut(values),
    successEvent: attendanceEvents.clockedOut,
    failureEvent: attendanceEvents.clockOutFailed,
  })
}

export function useStartBreak() {
  return useAttendanceMutation({
    mutationFn: () => startBreak(),
    successEvent: attendanceEvents.breakStarted,
    failureEvent: attendanceEvents.breakStartFailed,
  })
}

export function useEndBreak() {
  return useAttendanceMutation({
    mutationFn: () => endBreak(),
    successEvent: attendanceEvents.breakEnded,
    failureEvent: attendanceEvents.breakEndFailed,
  })
}

export function useSaveAttendanceSettings() {
  return useAttendanceMutation({
    mutationFn: (settings: AttendanceSettingsRow) => updateAttendanceSettings(settings),
    successEvent: attendanceEvents.settingsSaved,
    failureEvent: attendanceEvents.settingsSaveFailed,
  })
}
