import { MENTION_EVERYONE } from '../schema'

// Written in prose it is unambiguous, unlike a person's name, so the body is read for it too.
const EVERYONE_PATTERN = /(^|\s)@everyone\b/iu

export function mentionsEveryone(body: string, mentionUserIds: readonly string[]): boolean {
  return mentionUserIds.includes(MENTION_EVERYONE) || EVERYONE_PATTERN.test(body)
}
