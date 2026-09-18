'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { uploadTaskAttachment } from '../actions'
import { taskEvents } from '../events'
import { taskKeys } from '../query-keys'
import {
  createComment,
  deleteAttachment,
  deleteComment,
  listConversation,
  updateComment,
} from '../rpc'
import type {
  CommentFormValues,
  TaskAttachmentRow,
  TaskCommentRow,
  TaskConversation,
} from '../schema'

const EMPTY: TaskConversation = { comments: [], attachments: [] }

export function useConversation(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.conversation(taskId ?? ''),
    queryFn: () => listConversation(taskId ?? ''),
    enabled: Boolean(taskId),
  })
}

/**
 * Every write patches the cached conversation immediately and restores the snapshot it took on
 * failure, so the thread never waits on the server to show what was just said.
 */
function useConversationMutation<TVariables>(options: {
  taskId: string
  mutationFn: (variables: TVariables) => Promise<unknown>
  apply: (conversation: TaskConversation, variables: TVariables) => TaskConversation
  successEvent: (typeof taskEvents)[keyof typeof taskEvents]
  failureEvent: (typeof taskEvents)[keyof typeof taskEvents]
}) {
  const queryClient = useQueryClient()
  const key = taskKeys.conversation(options.taskId)

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      // An in-flight refetch would land on top of the optimistic thread.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<TaskConversation>(key)
      queryClient.setQueryData<TaskConversation>(key, options.apply(previous ?? EMPTY, variables))
      return { previous }
    },
    onError: (error: Error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous)
      // The row snapping back explains nothing on its own.
      announceFailure(error.message)
      track(options.failureEvent, { reason: error.message })
    },
    onSuccess: () => track(options.successEvent),
    onSettled: () => {
      // The board badges the counts, so it is stale the moment a comment lands.
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: taskKeys.boards() })
    },
  })
}

export function usePostComment(taskId: string, author: { userId: string; name: string }) {
  return useConversationMutation<CommentFormValues & { pendingFiles: TaskAttachmentRow[] }>({
    taskId,
    mutationFn: (values) =>
      createComment({
        taskId,
        body: values.body,
        mentionUserIds: values.mentionUserIds,
        attachmentIds: values.attachmentIds,
      }),
    apply: (conversation, values) => {
      // Replaced by the server's row on settle; an index would collide the moment two land.
      const id = crypto.randomUUID()
      const optimistic: TaskCommentRow = {
        id,
        taskId,
        authorId: author.userId,
        authorName: author.name,
        body: values.body,
        mentions: [],
        attachments: values.pendingFiles.map((file) => ({ ...file, commentId: id })),
        editedAt: undefined,
        createdAt: new Date().toISOString(),
      }

      return {
        comments: [...conversation.comments, optimistic],
        attachments: conversation.attachments.map((file) =>
          values.attachmentIds.includes(file.id) ? { ...file, commentId: id } : file,
        ),
      }
    },
    successEvent: taskEvents.commented,
    failureEvent: taskEvents.commentFailed,
  })
}

export function useEditComment(taskId: string) {
  return useConversationMutation<{
    commentId: string
    body: string
    mentionUserIds: readonly string[]
  }>({
    taskId,
    mutationFn: (values) => updateComment(values.commentId, values.body, values.mentionUserIds),
    apply: (conversation, values) => ({
      ...conversation,
      comments: conversation.comments.map((comment) =>
        comment.id === values.commentId
          ? { ...comment, body: values.body, editedAt: new Date().toISOString() }
          : comment,
      ),
    }),
    successEvent: taskEvents.commentEdited,
    failureEvent: taskEvents.commentEditFailed,
  })
}

export function useDeleteComment(taskId: string) {
  return useConversationMutation<{ commentId: string }>({
    taskId,
    mutationFn: (values) => deleteComment(values.commentId),
    apply: (conversation, values) => ({
      comments: conversation.comments.filter((comment) => comment.id !== values.commentId),
      attachments: conversation.attachments.filter((file) => file.commentId !== values.commentId),
    }),
    successEvent: taskEvents.commentDeleted,
    failureEvent: taskEvents.commentDeleteFailed,
  })
}

export function useDeleteAttachment(taskId: string) {
  return useConversationMutation<{ attachmentId: string }>({
    taskId,
    mutationFn: (values) => deleteAttachment(values.attachmentId),
    apply: (conversation, values) => ({
      comments: conversation.comments.map((comment) => ({
        ...comment,
        attachments: comment.attachments.filter((file) => file.id !== values.attachmentId),
      })),
      attachments: conversation.attachments.filter((file) => file.id !== values.attachmentId),
    }),
    successEvent: taskEvents.attachmentDeleted,
    failureEvent: taskEvents.attachmentDeleteFailed,
  })
}

/**
 * Not optimistic: the row only exists once the bytes are stored, and the id the composer needs
 * to attach it to a comment is the server's.
 */
export function useUploadAttachment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData()
      body.set('taskId', taskId)
      body.set('file', file)

      const result = await uploadTaskAttachment(body)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => track(taskEvents.attached),
    onError: (error: Error) => {
      announceFailure(error.message)
      track(taskEvents.attachFailed, { reason: error.message })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.conversation(taskId) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.boards() })
    },
  })
}
