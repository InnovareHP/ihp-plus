'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { taskEvents } from '../events'
import { taskKeys } from '../query-keys'
import { listMentions, markAllMentionsRead, markMentionRead } from '../rpc'
import type { TaskMentionFeed } from '../schema'

const EMPTY: TaskMentionFeed = { mentions: [], unreadCount: 0 }

/**
 * Someone else writes these, so the bell polls: a mention the viewer never learns about is the
 * whole reason the readAt column exists.
 */
export function useMentions(includeRead: boolean) {
  return useQuery({
    queryKey: taskKeys.mentions(includeRead),
    queryFn: () => listMentions(includeRead),
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  })
}

function useMentionMutation<TVariables>(options: {
  mutationFn: (variables: TVariables) => Promise<void>
  apply: (feed: TaskMentionFeed, variables: TVariables) => TaskMentionFeed
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      // An in-flight poll would land on top of the badge that just cleared.
      await queryClient.cancelQueries({ queryKey: taskKeys.mentionFeeds() })
      const previous = queryClient.getQueriesData<TaskMentionFeed>({
        queryKey: taskKeys.mentionFeeds(),
      })

      for (const [key, feed] of previous) {
        if (feed) queryClient.setQueryData<TaskMentionFeed>(key, options.apply(feed, variables))
      }

      return { previous }
    },
    onError: (error: Error, _variables, context) => {
      for (const [key, feed] of context?.previous ?? []) {
        queryClient.setQueryData(key, feed)
      }
      track(taskEvents.mentionReadFailed, { reason: error.message })
      announceFailure(error.message)
    },
    onSuccess: () => track(taskEvents.mentionRead),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.mentionFeeds() })
    },
  })
}

export function useMarkMentionRead() {
  return useMentionMutation<{ commentId: string; read: boolean }>({
    mutationFn: ({ commentId, read }) => markMentionRead(commentId, read),
    apply: (feed, { commentId, read }) => {
      const target = feed.mentions.find((mention) => mention.commentId === commentId)
      if (!target || target.isRead === read) return feed

      return {
        unreadCount: Math.max(feed.unreadCount + (read ? -1 : 1), 0),
        mentions: feed.mentions.map((mention) =>
          mention.commentId === commentId ? { ...mention, isRead: read } : mention,
        ),
      }
    },
  })
}

export function useMarkAllMentionsRead() {
  return useMentionMutation<void>({
    mutationFn: () => markAllMentionsRead(),
    apply: (feed) => ({
      unreadCount: 0,
      mentions: feed.mentions.map((mention) => ({ ...mention, isRead: true })),
    }),
  })
}

export function mentionFeedOf(data: TaskMentionFeed | undefined): TaskMentionFeed {
  return data ?? EMPTY
}
