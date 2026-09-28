'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import type { FormField, RequestValues } from '@/features/requests/schema'
import { hiringEvents } from '../events'
import { hiringKeys } from '../query-keys'
import { getInterview, submitScorecard } from '../rpc'
import type { InterviewerView, Recommendation } from '../schema'

export function useInterviewerView(interviewId: string, initialData: InterviewerView) {
  return useQuery({
    queryKey: hiringKeys.interview(interviewId),
    queryFn: () => getInterview(interviewId),
    initialData,
  })
}

// Not optimistic: the form itself shows what was typed, and "saved" should mean the server has it.
export function useSubmitScorecard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: {
      interviewId: string
      recommendation: Recommendation
      fields: readonly FormField[]
      answers: RequestValues
    }) => submitScorecard(values),
    onSuccess: (scorecard) => {
      track(hiringEvents.scorecardSubmitted, { recommendation: scorecard.recommendation })
      queryClient.setQueryData<InterviewerView>(
        hiringKeys.interview(scorecard.interviewId),
        (view) => (view ? { ...view, mine: scorecard } : view),
      )
    },
    onError: (error: Error) => track(hiringEvents.scorecardSubmitFailed, { reason: error.message }),
  })
}
