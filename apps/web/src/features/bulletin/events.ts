import type { EventName } from '@/lib/analytics'

export const bulletinEvents = {
  postCreated: 'bulletin.post.created',
  postCreateFailed: 'bulletin.post.create_failed',
  postEdited: 'bulletin.post.edited',
  postEditFailed: 'bulletin.post.edit_failed',
  postDeleted: 'bulletin.post.deleted',
  postDeleteFailed: 'bulletin.post.delete_failed',
  postPinned: 'bulletin.post.pinned',
  postPinFailed: 'bulletin.post.pin_failed',
  reactionToggled: 'bulletin.reaction.toggled',
  reactionToggleFailed: 'bulletin.reaction.toggle_failed',
  commentCreated: 'bulletin.comment.created',
  commentCreateFailed: 'bulletin.comment.create_failed',
  commentDeleted: 'bulletin.comment.deleted',
  commentDeleteFailed: 'bulletin.comment.delete_failed',
} as const satisfies Record<string, EventName>
