'use client'

import { useQuery } from '@tanstack/react-query'
import { useOptimisticListMutation } from '@/lib/optimistic'
import { bulletinEvents } from '../events'
import { bulletinKeys } from '../query-keys'
import { createComment, deleteComment, listComments } from '../rpc'
import type { BulletinCommentRow, CommentFormValues } from '../schema'
import { useUndoableDelete } from './use-undoable-delete'

// An open thread is one someone may be answering on right now.
const THREAD_POLL = 15 * 1000

/** `enabled` keeps a closed thread from costing a request. */
export function useComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: bulletinKeys.comments(postId),
    queryFn: () => listComments(postId),
    enabled,
    staleTime: 10 * 1000,
    refetchInterval: enabled ? THREAD_POLL : false,
  })
}

export function useCreateComment(postId: string, viewerId: string) {
  return useOptimisticListMutation<BulletinCommentRow, CommentFormValues>({
    queryKey: bulletinKeys.comments(postId),
    mutationFn: async ({ body, mentionUserIds }) => {
      await createComment(postId, body, mentionUserIds)
    },
    apply: (comments, { body }) => [
      ...comments,
      {
        id: crypto.randomUUID(),
        postId,
        authorId: viewerId,
        authorName: '',
        body,
        editedAt: undefined,
        createdAt: new Date().toISOString(),
        isSending: true,
      },
    ],
    successEvent: bulletinEvents.commentCreated,
    failureEvent: bulletinEvents.commentCreateFailed,
    // The reply count on the post lives in the feed.
    alsoInvalidate: [bulletinKeys.feeds()],
  })
}

export function useDeleteComment(postId: string) {
  return useUndoableDelete<BulletinCommentRow[]>({
    queryKey: bulletinKeys.comments(postId),
    mutationFn: deleteComment,
    remove: (comments, commentId) => comments.filter((comment) => comment.id !== commentId),
    message: 'Reply removed.',
    successEvent: bulletinEvents.commentDeleted,
    failureEvent: bulletinEvents.commentDeleteFailed,
    alsoInvalidate: [bulletinKeys.feeds()],
  })
}
