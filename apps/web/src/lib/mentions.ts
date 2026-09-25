/** Someone a composer can @mention: the id is what is stored, the name is what is typed. */
export interface MentionPerson {
  userId: string
  name: string
}

/** The one mention that names nobody in particular: it stands for the whole organization. */
export const MENTION_EVERYONE = 'everyone'

export const MENTION_EVERYONE_LABEL = 'Everyone in this organization'

// Written in prose it is unambiguous, unlike a person's name, so the body is read for it too.
const EVERYONE_PATTERN = /(^|\s)@everyone\b/iu

export function mentionsEveryone(body: string, mentionUserIds: readonly string[]): boolean {
  return mentionUserIds.includes(MENTION_EVERYONE) || EVERYONE_PATTERN.test(body)
}
