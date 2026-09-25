'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { bulletinEvents } from '../events'
import { bulletinKeys } from '../query-keys'
import { getSettings, updateSettings } from '../rpc'
import type { BulletinSettingsRow } from '../schema'

/** `enabled` keeps a closed dialog from costing a request. */
export function useBulletinSettings(enabled: boolean) {
  return useQuery({
    queryKey: bulletinKeys.settings(),
    queryFn: getSettings,
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSaveBulletinSettings() {
  const queryClient = useQueryClient()
  const key = bulletinKeys.settings()

  return useMutation({
    mutationFn: (next: BulletinSettingsRow) => updateSettings(next),
    onMutate: async (next: BulletinSettingsRow) => {
      // An in-flight read would land on top of the switches the admin just flipped.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BulletinSettingsRow>(key)
      queryClient.setQueryData(key, next)
      return { previous }
    },
    onError: (error: Error, _next, context) => {
      queryClient.setQueryData(key, context?.previous)
      announceFailure(error.message)
      track(bulletinEvents.settingsSaveFailed, { reason: error.message })
    },
    onSuccess: () => track(bulletinEvents.settingsSaved),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
