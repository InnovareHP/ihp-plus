import type {
  BulletinComment as BulletinCommentMessage,
  BulletinPost as BulletinPostMessage,
  BulletinSettings as BulletinSettingsMessage,
  ListAcknowledgementsResponse,
} from '@ihp/rpc/bulletin'
import {
  DEFAULT_BULLETIN_SETTINGS,
  postKindOf,
  type AcknowledgementList,
  type BulletinCommentRow,
  type BulletinPostRow,
  type BulletinSettingsRow,
} from '@/features/bulletin/schema'

export function postToProto(post: BulletinPostRow): BulletinPostMessage {
  return {
    $typeName: 'ihp.bulletin.v1.BulletinPost',
    id: post.id,
    kind: post.kind,
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
    requiresAck: post.requiresAck,
    acknowledgedByMe: post.acknowledgedByMe,
    ackCount: post.ackCount,
    ackAudience: post.ackAudience,
  }
}

export function postFromProto(post: BulletinPostMessage): BulletinPostRow {
  return {
    id: post.id,
    kind: postKindOf(post.kind),
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
    requiresAck: post.requiresAck,
    acknowledgedByMe: post.acknowledgedByMe,
    ackCount: post.ackCount,
    ackAudience: post.ackAudience,
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

export function settingsToProto(settings: BulletinSettingsRow): BulletinSettingsMessage {
  return { $typeName: 'ihp.bulletin.v1.BulletinSettings', ...settings }
}

export function settingsFromProto(
  settings: BulletinSettingsMessage | undefined,
): BulletinSettingsRow {
  if (!settings) return DEFAULT_BULLETIN_SETTINGS
  return {
    celebrateBirthdays: settings.celebrateBirthdays,
    celebrateAnniversaries: settings.celebrateAnniversaries,
    welcomeNewHires: settings.welcomeNewHires,
  }
}

export function acknowledgementsToProto(
  list: AcknowledgementList,
): Omit<ListAcknowledgementsResponse, '$typeName'> {
  const person = (row: AcknowledgementList['confirmed'][number]) => ({
    $typeName: 'ihp.bulletin.v1.AcknowledgementPerson' as const,
    ...row,
  })
  return { confirmed: list.confirmed.map(person), waiting: list.waiting.map(person) }
}

export function acknowledgementsFromProto(
  response: ListAcknowledgementsResponse,
): AcknowledgementList {
  const person = (row: ListAcknowledgementsResponse['confirmed'][number]) => ({
    userId: row.userId,
    name: row.name,
    acknowledgedAt: row.acknowledgedAt,
  })
  return { confirmed: response.confirmed.map(person), waiting: response.waiting.map(person) }
}
