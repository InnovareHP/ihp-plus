'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure, announceSuccess } from '@/lib/announce'
import {
  approveDigestIssue,
  generateDigestDraft,
  getDigestOverview,
  rejectDigestIssue,
  saveDigestSettings,
  sendDigestIssueNow,
  sendDigestTest,
  type Result,
} from './actions'
import { digestEvents } from './events'
import { digestKeys } from './query-keys'
import type { DigestOverview, DigestStatus, IssueIdValues, SettingsValues } from './schema'

async function unwrap<T>(result: Promise<Result<T>>) {
  const settled = await result
  if (!settled.ok) throw new Error(settled.message)
  return settled.data
}

export function useDigestOverview() {
  return useQuery({
    queryKey: digestKeys.overview(),
    queryFn: () => unwrap(getDigestOverview()),
    // Drafts appear once a week; a minute keeps tab switches from refetching for nothing.
    staleTime: 60 * 1000,
  })
}

export function useSaveDigestSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: SettingsValues) => unwrap(saveDigestSettings(values)),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: digestKeys.overview() })
      const previous = queryClient.getQueryData<DigestOverview>(digestKeys.overview())
      queryClient.setQueryData<DigestOverview>(digestKeys.overview(), (overview) =>
        overview ? { ...overview, settings: values } : overview,
      )
      return { previous }
    },
    onSuccess: () => track(digestEvents.settingsSaved),
    onError: (error: Error, _values, context) => {
      queryClient.setQueryData(digestKeys.overview(), context?.previous)
      track(digestEvents.settingsSaveFailed, { reason: error.message })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: digestKeys.overview() }),
  })
}

// The draft's content comes back from the model, so there is nothing to show before it lands.
export function useGenerateDigestDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => {
      track(digestEvents.draftRequested)
      return unwrap(generateDigestDraft())
    },
    onSuccess: (data) => {
      track(digestEvents.draftCreated, { created: data.created })
      if (!data.created) announceSuccess('Next week’s issue is already drafted.')
    },
    onError: (error: Error) => {
      track(digestEvents.draftFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: digestKeys.overview() }),
  })
}

/** Approve and reject move the row's badge at once, and snap it back if the server says no. */
type DigestEvent = (typeof digestEvents)[keyof typeof digestEvents]

function useDecision(
  action: (values: IssueIdValues) => Promise<Result<unknown>>,
  status: DigestStatus,
  events: { success: DigestEvent; failure: DigestEvent },
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: IssueIdValues) => unwrap(action(values)),
    onMutate: async ({ issueId }) => {
      await queryClient.cancelQueries({ queryKey: digestKeys.overview() })
      const previous = queryClient.getQueryData<DigestOverview>(digestKeys.overview())
      queryClient.setQueryData<DigestOverview>(digestKeys.overview(), (overview) =>
        overview
          ? {
              ...overview,
              issues: overview.issues.map((issue) =>
                issue.id === issueId ? { ...issue, status } : issue,
              ),
            }
          : overview,
      )
      return { previous }
    },
    onSuccess: (_data, { issueId }) => track(events.success, { issueId }),
    onError: (error: Error, { issueId }, context) => {
      queryClient.setQueryData(digestKeys.overview(), context?.previous)
      track(events.failure, { issueId, reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: digestKeys.overview() }),
  })
}

export function useApproveDigestIssue() {
  return useDecision(approveDigestIssue, 'approved', {
    success: digestEvents.approved,
    failure: digestEvents.approveFailed,
  })
}

export function useRejectDigestIssue() {
  return useDecision(rejectDigestIssue, 'rejected', {
    success: digestEvents.rejected,
    failure: digestEvents.rejectFailed,
  })
}

// Not optimistic: how many addresses accept it is only known once the mail server answers.
export function useSendDigestNow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: IssueIdValues) => unwrap(sendDigestIssueNow(values)),
    onSuccess: (data, { issueId }) => {
      track(digestEvents.sent, { issueId, sent: data.sent, failed: data.failed })
      announceSuccess(
        data.failed === 0
          ? `Sent to ${data.sent} ${data.sent === 1 ? 'person' : 'people'}.`
          : `Sent to ${data.sent}; ${data.failed} could not be reached.`,
      )
    },
    onError: (error: Error, { issueId }) => {
      track(digestEvents.sendFailed, { issueId, reason: error.message })
      announceFailure(error.message)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: digestKeys.overview() }),
  })
}

export function useSendDigestTest() {
  return useMutation({
    mutationFn: (values: IssueIdValues) => unwrap(sendDigestTest(values)),
    onSuccess: (data, { issueId }) => {
      track(digestEvents.testSent, { issueId })
      announceSuccess(`Test sent to ${data.to}.`)
    },
    onError: (error: Error, { issueId }) => {
      track(digestEvents.testFailed, { issueId, reason: error.message })
      announceFailure(error.message)
    },
  })
}
