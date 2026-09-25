/** What the caret is part-way through typing after an "@", if anything. */
export interface MentionQuery {
  /** Index of the "@" itself, so the replacement knows where to start. */
  start: number
  /** What has been typed after it, which filters the list. */
  text: string
}

// An @ only opens the list at the start of a word, and a name is at most two words long — the
// same shape the server parses out of a posted body.
const TRAILING_MENTION = /(?:^|[\s(])@([\p{L}\p{N}'’.-]*(?: [\p{L}\p{N}'’.-]*)?)$/u

export function mentionQueryAt(value: string, caret: number): MentionQuery | undefined {
  const before = value.slice(0, caret)
  const match = TRAILING_MENTION.exec(before)
  if (!match) return undefined

  const text = match[1] ?? ''
  return { start: caret - text.length - 1, text }
}

export interface MentionInsertion {
  value: string
  /** Where the caret lands, which is after the space the name is followed by. */
  caret: number
}

/** Replaces the half-typed "@grac" with the whole name, and leaves a space to carry on. */
export function insertMention(value: string, query: MentionQuery, name: string): MentionInsertion {
  const head = `${value.slice(0, query.start)}@${name} `
  return { value: `${head}${value.slice(query.start + 1 + query.text.length)}`, caret: head.length }
}

export function matchesMention(name: string, text: string): boolean {
  return name.toLowerCase().includes(text.trim().toLowerCase())
}
