import { MENTION_EVERYONE, type MentionPerson } from '@/lib/mentions'

/**
 * Keeps only the people whose @name is still in the text: picking a name and then deleting it
 * must not email them anyway.
 */
export function keepMentionedIds(
  body: string,
  userIds: readonly string[],
  people: readonly MentionPerson[],
): string[] {
  const names = new Map(people.map((person) => [person.userId, person.name]))
  return [...new Set(userIds)].filter((id) => {
    const name = id === MENTION_EVERYONE ? 'everyone' : names.get(id)
    return name !== undefined && body.toLowerCase().includes(`@${name.toLowerCase()}`)
  })
}
