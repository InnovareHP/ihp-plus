'use client'

import { ConnectError } from '@ihp/rpc'
import type { MentionPerson } from '@/lib/mentions'
import { browserClients } from '@/rpc/browser'
import {
  commentFromProto,
  postFromProto,
  settingsFromProto,
  settingsToProto,
} from '@/rpc/bulletin-codec'
import type {
  BulletinCommentRow,
  BulletinFeed,
  BulletinPostRow,
  BulletinSettingsRow,
} from './schema'

// ConnectError stringifies as "[code] message"; the UI shows only the sentence.
async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

function requiredPost(post: Parameters<typeof postFromProto>[0] | undefined): BulletinPostRow {
  if (!post) throw new Error('The server did not return the post.')
  return postFromProto(post)
}

export async function listPosts(limit: number): Promise<BulletinFeed> {
  const response = await call(() => browserClients.bulletin.listPosts({ limit }))
  return {
    posts: response.posts.map(postFromProto),
    hasMore: response.hasMore,
    viewerId: response.viewerId,
    canModerate: response.canModerate,
  }
}

export async function createPost(
  body: string,
  imageIds: readonly string[] = [],
  mentionUserIds: readonly string[] = [],
): Promise<BulletinPostRow> {
  const response = await call(() =>
    browserClients.bulletin.createPost({
      body,
      imageIds: [...imageIds],
      mentionUserIds: [...mentionUserIds],
    }),
  )
  return requiredPost(response.post)
}

export async function updatePost(postId: string, body: string): Promise<BulletinPostRow> {
  const response = await call(() => browserClients.bulletin.updatePost({ postId, body }))
  return requiredPost(response.post)
}

export async function deletePost(postId: string): Promise<void> {
  await call(() => browserClients.bulletin.deletePost({ postId }))
}

export async function setPostPinned(postId: string, pinned: boolean): Promise<BulletinPostRow> {
  const response = await call(() => browserClients.bulletin.setPostPinned({ postId, pinned }))
  return requiredPost(response.post)
}

export async function toggleReaction(postId: string, emoji: string): Promise<BulletinPostRow> {
  const response = await call(() => browserClients.bulletin.toggleReaction({ postId, emoji }))
  return requiredPost(response.post)
}

export async function listComments(postId: string): Promise<BulletinCommentRow[]> {
  const response = await call(() => browserClients.bulletin.listComments({ postId }))
  return response.comments.map(commentFromProto)
}

export async function createComment(
  postId: string,
  body: string,
  mentionUserIds: readonly string[] = [],
): Promise<BulletinCommentRow> {
  const response = await call(() =>
    browserClients.bulletin.createComment({
      postId,
      body,
      mentionUserIds: [...mentionUserIds],
    }),
  )
  if (!response.comment) throw new Error('The server did not return the reply.')
  return commentFromProto(response.comment)
}

export async function deleteComment(commentId: string): Promise<void> {
  await call(() => browserClients.bulletin.deleteComment({ commentId }))
}

export async function getSettings(): Promise<BulletinSettingsRow> {
  const response = await call(() => browserClients.bulletin.getSettings({}))
  return settingsFromProto(response.settings)
}

export async function updateSettings(settings: BulletinSettingsRow): Promise<BulletinSettingsRow> {
  const response = await call(() =>
    browserClients.bulletin.updateSettings({ settings: settingsToProto(settings) }),
  )
  return settingsFromProto(response.settings)
}

export async function listPeople(): Promise<MentionPerson[]> {
  const response = await call(() => browserClients.bulletin.listPeople({}))
  return response.people.map((person) => ({ userId: person.userId, name: person.name }))
}
