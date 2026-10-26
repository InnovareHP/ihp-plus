// A draft is plain text in a tiny markup both the preview and the PDF read: "# " and "## "
// headings, "- " bullets, blank-line paragraphs, and [locked] … [/locked] around fixed legal text.

export const LOCK_START = '[locked]'
export const LOCK_END = '[/locked]'

export type BlockKind = 'title' | 'heading' | 'paragraph' | 'bullet'

export interface Block {
  kind: BlockKind
  text: string
  locked: boolean
}

// Client details are optional and written in by hand on the printed copy.
export const BLANK = '_______'
const CLIENT_FIELD = /\{\{\s*client_[a-z0-9_]*\s*\}\}/gi

export function parseDocument(body: string): Block[] {
  const blocks: Block[] = []
  let locked = false
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join(' '), locked })
    paragraph = []
  }

  for (const raw of body.replace(CLIENT_FIELD, BLANK).split(/\r?\n/)) {
    const line = raw.trim()
    if (line === LOCK_START || line === LOCK_END) {
      flush()
      locked = line === LOCK_START
    } else if (!line) {
      flush()
    } else if (line.startsWith('# ')) {
      flush()
      blocks.push({ kind: 'title', text: line.slice(2).trim(), locked })
    } else if (line.startsWith('## ')) {
      flush()
      blocks.push({ kind: 'heading', text: line.slice(3).trim(), locked })
    } else if (line.startsWith('- ')) {
      flush()
      blocks.push({ kind: 'bullet', text: line.slice(2).trim(), locked })
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return blocks
}

const FIELD = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

/** The required {{placeholders}} still waiting for a value, each named once. */
export function missingFields(body: string) {
  const names = [...body.matchAll(FIELD)].map((match) => match[1] ?? '')
  return [...new Set(names.filter((name) => !name.startsWith('client_')))]
}

const LOCKED_BLOCK = /\[locked\][\s\S]*?\[\/locked\]/g
const LOCKED_TOKEN = /\[locked section \d+\]/
const tokenOf = (index: number) => `[locked section ${index + 1}]`

/** The body with each locked section swapped for a one-line token, so the AI never rewrites it. */
export function hideLocked(body: string) {
  const sections: string[] = []
  const text = body.replace(LOCKED_BLOCK, (section) => tokenOf(sections.push(section) - 1))
  return { text, sections }
}

/** Puts the locked sections back, or undefined when a token was dropped, repeated or invented. */
export function restoreLocked(text: string, sections: readonly string[]) {
  let restored = text
  for (const [index, section] of sections.entries()) {
    const token = tokenOf(index)
    if (restored.split(token).length !== 2) return undefined
    restored = restored.replace(token, () => section)
  }
  return LOCKED_TOKEN.test(restored) ? undefined : restored
}
