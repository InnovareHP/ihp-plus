import { MENTION_EVERYONE, type TaskAssigneeRef } from '../schema'

/** The thread shows the people this client has loaded; the server expands @everyone properly. */
export function resolveMentions(
  mentionUserIds: readonly string[],
  colleagues: readonly TaskAssigneeRef[],
): TaskAssigneeRef[] {
  return mentionUserIds.includes(MENTION_EVERYONE)
    ? [...colleagues]
    : colleagues.filter((person) => mentionUserIds.includes(person.userId))
}
