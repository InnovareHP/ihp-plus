'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track, type EventName } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { taskEvents } from '../events'
import { taskKeys } from '../query-keys'
import {
  deleteTimeEntry,
  getRunningTimer,
  getTimeSettings,
  listTimeEntries,
  logTime,
  startTimer,
  stopTimer,
  updateTimeSettings,
} from '../rpc'
import type { LogTimeValues, TaskTimeSettingsRow } from '../schema'

export function useTimeSettings() {
  return useQuery({
    queryKey: taskKeys.timeSettings(),
    queryFn: getTimeSettings,
    // Rules change about as often as the company does.
    staleTime: 30 * 60 * 1000,
  })
}

export function useTimeLog(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.timeLog(taskId ?? ''),
    queryFn: () => listTimeEntries(taskId as string),
    enabled: Boolean(taskId),
  })
}

/**
 * The header's clock. It polls so the chip survives a second tab starting a timer elsewhere,
 * and because the auto-stop the admin set is applied server-side on the way past.
 */
export function useRunningTimer() {
  return useQuery({
    queryKey: taskKeys.runningTimer(),
    queryFn: getRunningTimer,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 15 * 1000,
  })
}

/** Hours are counted, not guessed: every write refetches rather than patching a total by hand. */
function useTimeMutation<TVariables, TResult>(options: {
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
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useStartTimer() {
  return useTimeMutation({
    mutationFn: ({ taskId }: { taskId: string }) => startTimer(taskId),
    successEvent: taskEvents.timerStarted,
    failureEvent: taskEvents.timerStartFailed,
  })
}

export function useStopTimer() {
  return useTimeMutation({
    mutationFn: ({ note }: { note?: string }) => stopTimer(note),
    successEvent: taskEvents.timerStopped,
    failureEvent: taskEvents.timerStopFailed,
  })
}

export function useLogTime() {
  return useTimeMutation({
    mutationFn: (values: LogTimeValues) => logTime(values),
    successEvent: taskEvents.timeLogged,
    failureEvent: taskEvents.timeLogFailed,
  })
}

export function useDeleteTimeEntry() {
  return useTimeMutation({
    mutationFn: ({ entryId }: { entryId: string }) => deleteTimeEntry(entryId),
    successEvent: taskEvents.timeEntryDeleted,
    failureEvent: taskEvents.timeEntryDeleteFailed,
  })
}

export function useSaveTimeSettings() {
  return useTimeMutation({
    mutationFn: (settings: TaskTimeSettingsRow) => updateTimeSettings(settings),
    successEvent: taskEvents.timeSettingsSaved,
    failureEvent: taskEvents.timeSettingsSaveFailed,
  })
}
