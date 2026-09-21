import { MENTION_EVERYONE, type TaskAssigneeRef } from '../schema'

// Written in prose it is unambiguous, unlike a person's name, so the body is read for it too.
const EVERYONE_PATTERN = /(^|\s)@everyone\b/iu

export function mentionsEveryone(body: string, mentionUserIds: readonly string[]): boolean {
  return mentionUserIds.includes(MENTION_EVERYONE) || EVERYONE_PATTERN.test(body)
}

/** The thread shows the people this client has loaded; the server expands @everyone properly. */
export function resolveMentions(
  mentionUserIds: readonly string[],
  colleagues: readonly TaskAssigneeRef[],
): TaskAssigneeRef[] {
  return mentionUserIds.includes(MENTION_EVERYONE)
    ? [...colleagues]
    : colleagues.filter((person) => mentionUserIds.includes(person.userId))
}
