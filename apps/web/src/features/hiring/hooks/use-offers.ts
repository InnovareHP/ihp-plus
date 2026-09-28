'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { sendOffer } from '../actions'
import { hiringEvents } from '../events'
import { answerOffer } from '../public-actions'
import { hiringKeys } from '../query-keys'
import type { SendOfferFormValues } from '../schema'

// Not optimistic: the letter is stored first and the offer only exists once the server has it.
export function useSendOffer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: SendOfferFormValues) => {
      const form = new FormData()
      form.set('applicationId', values.applicationId)
      form.set('message', values.message)
      if (values.letter) form.set('file', values.letter)
      const result = await sendOffer(form)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: (detail) => {
      track(hiringEvents.offerSent, { withLetter: detail.offers[0]?.fileName !== undefined })
      queryClient.setQueryData(hiringKeys.application(detail.summary.id), detail)
    },
    onError: (error: Error) => track(hiringEvents.offerSendFailed, { reason: error.message }),
    onSettled: (_data, _error, values) => {
      queryClient.invalidateQueries({ queryKey: hiringKeys.application(values.applicationId) })
    },
  })
}

export function useAnswerOffer() {
  return useMutation({
    mutationFn: async (values: {
      applicationId: string
      signature: string
      offerId: string
      decision: 'accept' | 'decline'
      reason: string
    }) => {
      const result = await answerOffer(values)
      if (!result.ok) throw new Error(result.message)
      return values.decision
    },
    onSuccess: (decision) =>
      track(decision === 'accept' ? hiringEvents.offerAccepted : hiringEvents.offerDeclined),
    onError: (error: Error) => track(hiringEvents.offerAnswerFailed, { reason: error.message }),
  })
}
