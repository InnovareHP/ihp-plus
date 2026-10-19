export type SearchScope = 'actions' | 'pages' | 'people' | 'clients' | 'tasks'

/** The first character narrows the search to one kind; order is the order the hints show. */
export const SCOPE_PREFIXES: readonly { symbol: string; scope: SearchScope; label: string }[] = [
  { symbol: '>', scope: 'actions', label: 'Actions' },
  { symbol: '/', scope: 'pages', label: 'Pages' },
  { symbol: '@', scope: 'people', label: 'People' },
  { symbol: '$', scope: 'clients', label: 'Clients' },
  { symbol: '#', scope: 'tasks', label: 'Tasks' },
]

export interface ParsedQuery {
  scope: SearchScope | null
  /** What to match, without the prefix. */
  text: string
}

export function parseQuery(raw: string): ParsedQuery {
  const query = raw.trim()
  const prefix = SCOPE_PREFIXES.find((one) => query.startsWith(one.symbol))
  // "#12" stays a task-number search: the tasks search reads "12" as number 12 too.
  return prefix
    ? { scope: prefix.scope, text: query.slice(prefix.symbol.length).trim() }
    : { scope: null, text: query }
}
