import type {
  BulletinComment as BulletinCommentMessage,
  BulletinPost as BulletinPostMessage,
} from '@ihp/rpc/bulletin'
import type { BulletinCommentRow, BulletinPostRow } from '@/features/bulletin/schema'

export function postToProto(post: BulletinPostRow): BulletinPostMessage {
  return {
    $typeName: 'ihp.bulletin.v1.BulletinPost',
    id: post.id,
    authorId: post.authorId,
    authorName: post.authorName,
    body: post.body,
    pinnedAt: post.pinnedAt,
    editedAt: post.editedAt,
    createdAt: post.createdAt,
    commentCount: post.commentCount,
    reactions: post.reactions.map((reaction) => ({
      $typeName: 'ihp.bulletin.v1.ReactionSummary' as const,
      ...reaction,
    })),
    images: post.images.map((image) => ({
      $typeName: 'ihp.bulletin.v1.BulletinImage' as const,
      id: image.id,
      url: image.url,
    })),
  }
}

export function postFromProto(post: BulletinPostMessage): BulletinPostRow {
  return {
    id: post.id,
    authorId: post.authorId,
    authorName: post.authorName,
    body: post.body,
    pinnedAt: post.pinnedAt,
    editedAt: post.editedAt,
    createdAt: post.createdAt,
    commentCount: post.commentCount,
    reactions: post.reactions.map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
      reactedByMe: reaction.reactedByMe,
    })),
    images: post.images.map((image) => ({ id: image.id, url: image.url })),
  }
}

export function commentToProto(comment: BulletinCommentRow): BulletinCommentMessage {
  return {
    $typeName: 'ihp.bulletin.v1.BulletinComment',
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    body: comment.body,
    editedAt: comment.editedAt,
    createdAt: comment.createdAt,
  }
}

export function commentFromProto(comment: BulletinCommentMessage): BulletinCommentRow {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    body: comment.body,
    editedAt: comment.editedAt,
    createdAt: comment.createdAt,
  }
}
