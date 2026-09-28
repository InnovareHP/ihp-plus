'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { hiringEvents } from '../events'
import { hiringKeys } from '../query-keys'
import { getSettings, saveSettings } from '../rpc'
import type { HiringSettings, HiringSettingsValues } from '../schema'

export function useHiringSettings(initialData?: HiringSettings) {
  return useQuery({
    queryKey: hiringKeys.settings(),
    queryFn: getSettings,
    initialData,
    // Settings change a few times a year; refetching them on every focus would only flicker.
    staleTime: 5 * 60 * 1000,
  })
}

// Not optimistic: the form is the feedback, and saving can be refused for a department change.
export function useSaveHiringSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: HiringSettingsValues) => saveSettings(values),
    onSuccess: (settings) => {
      track(hiringEvents.settingsSaved)
      queryClient.setQueryData(hiringKeys.settings(), settings)
    },
    onError: (error: Error) => {
      track(hiringEvents.settingsSaveFailed, { reason: error.message })
    },
  })
}
