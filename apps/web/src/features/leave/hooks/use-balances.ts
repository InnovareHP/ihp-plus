'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { leaveKeys } from '../query-keys'
import { listMyBalances, listTeamBalances, previewLeave } from '../rpc'
import type { LeavePreviewInput } from '../schema'

// Balances move only when a request is made or decided, which invalidates them anyway.
const STALE_MS = 60 * 1000

export function useMyBalances(year: number | undefined) {
  return useQuery({
    queryKey: leaveKeys.mine(year),
    queryFn: () => listMyBalances(year),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  })
}

export function useTeamBalances(year: number | undefined, enabled = true) {
  return useQuery({
    queryKey: leaveKeys.team(year),
    queryFn: () => listTeamBalances(year),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  })
}

/** Undefined input waits: the requester has not picked both days yet. */
export function useLeavePreview(input: LeavePreviewInput | undefined) {
  return useQuery({
    queryKey: leaveKeys.preview(input ?? { submissionId: '' }),
    queryFn: () => previewLeave(input ?? { submissionId: '' }),
    enabled: input !== undefined,
    // The last count stays while a changed date is re-counted, so the notice does not flicker.
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  })
}
