import type { ServiceImpl } from '@ihp/rpc'
import { BulletinService } from '@ihp/rpc/bulletin'
import {
  acknowledgePost,
  createComment,
  createPost,
  deleteComment,
  deletePost,
  loadComments,
  loadAcknowledgements,
  loadFeed,
  loadUnreadCount,
  markSeen,
  loadPeople,
  loadSettings,
  saveSettings,
  setPostPinned,
  setPostRequiresAck,
  toggleReaction,
  updatePost,
} from '@/features/bulletin/service'
import {
  acknowledgementsToProto,
  commentToProto,
  postToProto,
  settingsFromProto,
  settingsToProto,
} from './bulletin-codec'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const bulletin: ServiceImpl<typeof BulletinService> = {
  listPosts: async (request) => {
    const feed = await loadFeed(request.limit)
    return {
      posts: feed.posts.map(postToProto),
      hasMore: feed.hasMore,
      viewerId: feed.viewerId,
      canModerate: feed.canModerate,
    }
  },

  createPost: async (request) => ({
    post: postToProto(
      await createPost(request.body, request.imageIds, request.mentionUserIds, request.requiresAck),
    ),
  }),

  updatePost: async (request) => ({
    post: postToProto(await updatePost(request.postId, request.body)),
  }),

  deletePost: async (request) => {
    await deletePost(request.postId)
    return {}
  },

  setPostPinned: async (request) => ({
    post: postToProto(await setPostPinned(request.postId, request.pinned)),
  }),

  toggleReaction: async (request) => ({
    post: postToProto(await toggleReaction(request.postId, request.emoji)),
  }),

  listComments: async (request) => ({
    comments: (await loadComments(request.postId)).map(commentToProto),
  }),

  createComment: async (request) => ({
    comment: commentToProto(
      await createComment(request.postId, request.body, request.mentionUserIds),
    ),
  }),

  deleteComment: async (request) => {
    await deleteComment(request.commentId)
    return {}
  },

  setPostRequiresAck: async (request) => ({
    post: postToProto(await setPostRequiresAck(request.postId, request.required)),
  }),

  acknowledgePost: async (request) => ({
    post: postToProto(await acknowledgePost(request.postId)),
  }),

  listAcknowledgements: async (request) =>
    acknowledgementsToProto(await loadAcknowledgements(request.postId)),

  getUnreadCount: async () => ({ count: await loadUnreadCount() }),

  markSeen: async () => ({ previousSeenAt: await markSeen() }),

  listPeople: async () => ({
    people: (await loadPeople()).map((person) => ({
      $typeName: 'ihp.bulletin.v1.MentionablePerson' as const,
      ...person,
    })),
  }),

  getSettings: async () => ({ settings: settingsToProto(await loadSettings()) }),

  updateSettings: async (request) => ({
    settings: settingsToProto(await saveSettings(settingsFromProto(request.settings))),
  }),
}
