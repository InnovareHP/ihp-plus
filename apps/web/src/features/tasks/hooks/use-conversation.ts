'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { offerUndo } from '@/lib/undo'
import { storeFiles } from '../attachments'
import { taskEvents } from '../events'
import { taskKeys } from '../query-keys'
import {
  createComment,
  deleteAttachment,
  deleteComment,
  listConversation,
  listTaskActivity,
  updateComment,
} from '../rpc'
import type {
  CommentFormValues,
  TaskAssigneeRef,
  TaskCommentRow,
  TaskConversation,
} from '../schema'

const EMPTY: TaskConversation = { comments: [] }

// A thread is a conversation: it is open precisely when someone may be answering on it.
const CONVERSATION_POLL = 30 * 1000

/** History only grows when something happened, so it is fetched once per open task. */
/** `enabled` is how the history tab pays for itself: nothing is fetched until it is opened. */
export function useTaskActivity(taskId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: taskKeys.activity(taskId ?? ''),
    queryFn: () => listTaskActivity(taskId as string),
    enabled: Boolean(taskId) && enabled,
    staleTime: 60 * 1000,
  })
}

export function useConversation(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.conversation(taskId ?? ''),
    queryFn: () => listConversation(taskId ?? ''),
    enabled: Boolean(taskId),
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: CONVERSATION_POLL,
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
  return useConversationMutation<
    Omit<CommentFormValues, 'attachmentIds'> & {
      files: readonly File[]
      mentions: TaskAssigneeRef[]
    }
  >({
    taskId,
    // The files are stored as the comment is posted, so a file never outlives a comment that
    // was abandoned; a comment that then fails takes what was just stored with it.
    mutationFn: async (values) => {
      const attachmentIds = await storeFiles(taskId, values.files)

      try {
        return await createComment({
          taskId,
          body: values.body,
          mentionUserIds: values.mentionUserIds,
          attachmentIds,
        })
      } catch (error) {
        await Promise.all(attachmentIds.map((id) => deleteAttachment(id).catch(() => undefined)))
        throw error
      }
    },
    apply: (conversation, values) => {
      // Replaced by the server's row on settle; an index would collide the moment two land.
      const id = crypto.randomUUID()
      const optimistic: TaskCommentRow = {
        id,
        taskId,
        authorId: author.userId,
        authorName: author.name,
        body: values.body,
        mentions: values.mentions,
        // Named from the picked file: the id and the link are the server's, and land on settle.
        attachments: values.files.map((file) => ({
          id: `pending-${file.name}`,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          url: '',
          uploadedByName: author.name,
          createdAt: new Date().toISOString(),
          commentId: id,
        })),
        editedAt: undefined,
        createdAt: new Date().toISOString(),
        isSending: true,
      }

      return { comments: [...conversation.comments, optimistic] }
    },
    successEvent: taskEvents.commented,
    failureEvent: taskEvents.commentFailed,
  })
}

export function useEditComment(taskId: string) {
  return useConversationMutation<{
    commentId: string
    body: string
    mentions: readonly TaskAssigneeRef[]
  }>({
    taskId,
    mutationFn: (values) =>
      updateComment(
        values.commentId,
        values.body,
        values.mentions.map((person) => person.userId),
      ),
    apply: (conversation, values) => ({
      ...conversation,
      comments: conversation.comments.map((comment) =>
        comment.id === values.commentId
          ? {
              ...comment,
              body: values.body,
              mentions: [...values.mentions],
              editedAt: new Date().toISOString(),
            }
          : comment,
      ),
    }),
    successEvent: taskEvents.commentEdited,
    failureEvent: taskEvents.commentEditFailed,
  })
}

/**
 * A delete the user can take back: the row goes at once, the server hears about it only when the
 * undo window closes, and undoing puts the snapshot back without a second call.
 */
function useUndoableRemoval(options: {
  taskId: string
  mutationFn: (id: string) => Promise<unknown>
  apply: (conversation: TaskConversation, id: string) => TaskConversation
  message: string
  undoLabel: string
  successEvent: (typeof taskEvents)[keyof typeof taskEvents]
  failureEvent: (typeof taskEvents)[keyof typeof taskEvents]
}) {
  const queryClient = useQueryClient()
  const key = taskKeys.conversation(options.taskId)

  const commit = useMutation({
    mutationFn: (variables: { id: string; previous: TaskConversation | undefined }) =>
      options.mutationFn(variables.id),
    onError: (error: Error, variables) => {
      queryClient.setQueryData(key, variables.previous)
      // The row coming back explains nothing on its own.
      announceFailure(error.message)
      track(options.failureEvent, { reason: error.message })
    },
    onSuccess: () => track(options.successEvent),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: taskKeys.boards() })
    },
  })

  async function remove(id: string) {
    // An in-flight refetch would put the row straight back.
    await queryClient.cancelQueries({ queryKey: key })
    const previous = queryClient.getQueryData<TaskConversation>(key)
    queryClient.setQueryData<TaskConversation>(key, options.apply(previous ?? EMPTY, id))

    offerUndo({
      message: options.message,
      undoLabel: options.undoLabel,
      onUndo: () => queryClient.setQueryData(key, previous),
      onCommit: () => commit.mutate({ id, previous }),
    })
  }

  return { remove, isPending: commit.isPending }
}

export function useDeleteComment(taskId: string) {
  return useUndoableRemoval({
    taskId,
    mutationFn: (commentId) => deleteComment(commentId),
    apply: (conversation, commentId) => ({
      comments: conversation.comments.filter((comment) => comment.id !== commentId),
    }),
    message: 'Comment deleted.',
    undoLabel: 'Undo',
    successEvent: taskEvents.commentDeleted,
    failureEvent: taskEvents.commentDeleteFailed,
  })
}

export function useDeleteAttachment(taskId: string) {
  return useUndoableRemoval({
    taskId,
    mutationFn: (attachmentId) => deleteAttachment(attachmentId),
    apply: (conversation, attachmentId) => ({
      comments: conversation.comments.map((comment) => ({
        ...comment,
        attachments: comment.attachments.filter((file) => file.id !== attachmentId),
      })),
    }),
    message: 'File removed.',
    undoLabel: 'Undo',
    successEvent: taskEvents.attachmentDeleted,
    failureEvent: taskEvents.attachmentDeleteFailed,
  })
}
