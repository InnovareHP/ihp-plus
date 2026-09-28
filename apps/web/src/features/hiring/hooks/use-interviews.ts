'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { hiringEvents } from '../events'
import { askForOtherTimes, bookInterview } from '../public-actions'
import { hiringKeys } from '../query-keys'
import { cancelInterview, listInterviewers, offerInterview, suggestSlots } from '../rpc'
import type { ApplicationDetail, OfferInterviewValues } from '../schema'

export function useInterviewers() {
  return useQuery({
    queryKey: hiringKeys.interviewers(),
    queryFn: listInterviewers,
    // Who works here changes far less often than who is being interviewed.
    staleTime: 5 * 60 * 1000,
  })
}

export function useSlotSuggestions(
  values: {
    interviewerIds: readonly string[]
    durationMinutes: number
    fromDate: string
    toDate: string
  },
  enabled: boolean,
) {
  return useQuery({
    queryKey: hiringKeys.suggestions(JSON.stringify(values)),
    queryFn: () => suggestSlots(values),
    enabled: enabled && values.interviewerIds.length > 0,
  })
}

function useApplicationWrite<TVariables>(
  mutationFn: (variables: TVariables) => Promise<ApplicationDetail>,
  events: { success: `${string}.${string}.${string}`; failure: `${string}.${string}.${string}` },
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (detail) => {
      track(events.success)
      queryClient.setQueryData(hiringKeys.application(detail.summary.id), detail)
      queryClient.invalidateQueries({ queryKey: hiringKeys.application(detail.summary.id) })
    },
    onError: (error: Error) => track(events.failure, { reason: error.message }),
  })
}

// Not optimistic: an offer emails the applicant, so the page waits for the server to say it went.
export function useOfferInterview(timeZone: string) {
  return useApplicationWrite((values: OfferInterviewValues) => offerInterview(values, timeZone), {
    success: hiringEvents.interviewOffered,
    failure: hiringEvents.interviewOfferFailed,
  })
}

// Not optimistic: a booked interview's cancellation reaches everyone's calendar.
export function useCancelInterview() {
  return useApplicationWrite((interviewId: string) => cancelInterview(interviewId), {
    success: hiringEvents.interviewCancelled,
    failure: hiringEvents.interviewCancelFailed,
  })
}

interface Link {
  applicationId: string
  signature: string
}

export function useBookInterview() {
  return useMutation({
    mutationFn: async (
      values: Link & { interviewId: string; slotId: string; timeZone: string },
    ) => {
      const result = await bookInterview(values)
      if (!result.ok) throw new Error(result.message)
    },
    onSuccess: () => track(hiringEvents.interviewBooked),
    onError: (error: Error) => track(hiringEvents.interviewBookFailed, { reason: error.message }),
  })
}

export function useAskForOtherTimes() {
  return useMutation({
    mutationFn: async (values: Link & { interviewId: string }) => {
      const result = await askForOtherTimes(values)
      if (!result.ok) throw new Error(result.message)
    },
    onSuccess: () => track(hiringEvents.interviewTimesAsked),
  })
}
