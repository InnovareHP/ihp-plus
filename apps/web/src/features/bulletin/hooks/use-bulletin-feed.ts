'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useOptimisticPagesMutation } from '@/lib/optimistic'
import { bulletinEvents } from '../events'
import { patchPost, sortFeed, toggleReactionIn } from '../feed'
import { bulletinKeys } from '../query-keys'
import {
  createPost,
  deletePost,
  listPosts,
  setPostPinned,
  toggleReaction,
  updatePost,
} from '../rpc'
import { bulletinImageUrl } from '../image-url'
import type { BulletinFeed, BulletinPostRow } from '../schema'
import { useUndoableDelete } from './use-undoable-delete'

// People talk on the board, so new posts arrive without a reload, just not every second.
const FEED_POLL = 30 * 1000

export function useBulletinFeed(limit: number) {
  return useQuery({
    queryKey: bulletinKeys.feed(limit),
    queryFn: () => listPosts(limit),
    placeholderData: keepPreviousData,
    staleTime: 10 * 1000,
    refetchInterval: FEED_POLL,
  })
}

export function useCreatePost() {
  return useOptimisticPagesMutation<BulletinFeed, { body: string; imageIds: string[] }>({
    queryKey: bulletinKeys.feeds(),
    mutationFn: async ({ body, imageIds }) => {
      await createPost(body, imageIds)
    },
    apply: (feed, { body, imageIds }) => {
      // Replaced by the server row on settle; an index would collide the moment two land.
      const optimistic: BulletinPostRow = {
        id: crypto.randomUUID(),
        authorId: feed.viewerId,
        authorName: '',
        body,
        pinnedAt: undefined,
        editedAt: undefined,
        createdAt: new Date().toISOString(),
        commentCount: 0,
        reactions: [],
        images: imageIds.map((id) => ({ id, url: bulletinImageUrl(id) })),
        isSending: true,
      }
      return { ...feed, posts: sortFeed([optimistic, ...feed.posts]) }
    },
    successEvent: bulletinEvents.postCreated,
    failureEvent: bulletinEvents.postCreateFailed,
  })
}

export function useEditPost() {
  return useOptimisticPagesMutation<BulletinFeed, { postId: string; body: string }>({
    queryKey: bulletinKeys.feeds(),
    mutationFn: async ({ postId, body }) => {
      await updatePost(postId, body)
    },
    apply: (feed, { postId, body }) =>
      patchPost(feed, postId, (post) => ({ ...post, body, editedAt: new Date().toISOString() })),
    successEvent: bulletinEvents.postEdited,
    failureEvent: bulletinEvents.postEditFailed,
  })
}

export function usePinPost() {
  return useOptimisticPagesMutation<BulletinFeed, { postId: string; pinned: boolean }>({
    queryKey: bulletinKeys.feeds(),
    mutationFn: async ({ postId, pinned }) => {
      await setPostPinned(postId, pinned)
    },
    apply: (feed, { postId, pinned }) => {
      const patched = patchPost(feed, postId, (post) => ({
        ...post,
        pinnedAt: pinned ? new Date().toISOString() : undefined,
      }))
      return { ...patched, posts: sortFeed(patched.posts) }
    },
    successEvent: bulletinEvents.postPinned,
    failureEvent: bulletinEvents.postPinFailed,
  })
}

export function useToggleReaction() {
  return useOptimisticPagesMutation<BulletinFeed, { postId: string; emoji: string }>({
    queryKey: bulletinKeys.feeds(),
    mutationFn: async ({ postId, emoji }) => {
      await toggleReaction(postId, emoji)
    },
    apply: (feed, { postId, emoji }) =>
      patchPost(feed, postId, (post) => ({
        ...post,
        reactions: toggleReactionIn(post.reactions, emoji),
      })),
    successEvent: bulletinEvents.reactionToggled,
    failureEvent: bulletinEvents.reactionToggleFailed,
  })
}

export function useDeletePost() {
  return useUndoableDelete<BulletinFeed>({
    queryKey: bulletinKeys.feeds(),
    mutationFn: deletePost,
    remove: (feed, postId) => ({ ...feed, posts: feed.posts.filter((post) => post.id !== postId) }),
    message: 'Post removed.',
    successEvent: bulletinEvents.postDeleted,
    failureEvent: bulletinEvents.postDeleteFailed,
  })
}
