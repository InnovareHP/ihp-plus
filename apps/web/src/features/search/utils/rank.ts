import type { SearchEntry } from '../schema'

// Accents are folded so "pena" still finds "Peña".
export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function scoreOf(entry: SearchEntry, query: string): number | null {
  const label = normalize(entry.label)
  if (label === query) return 0
  if (label.startsWith(query)) return 1
  if (label.split(/[\s›]+/).some((word) => word.startsWith(query))) return 2
  if (label.includes(query)) return 3

  const rest = normalize([...(entry.keywords ?? []), entry.description ?? ''].join(' '))
  if (rest.includes(query)) return 4

  const haystack = `${label} ${rest}`
  return query.split(/\s+/).every((word) => haystack.includes(word)) ? 5 : null
}

/** Label matches outrank description matches; ties keep the sidebar's order. */
export function rankEntries(entries: readonly SearchEntry[], query: string, limit: number) {
  const normalized = normalize(query)
  if (!normalized) return entries.slice(0, limit)

  return entries
    .map((entry, index) => ({ entry, index, score: scoreOf(entry, normalized) }))
    .filter(
      (hit): hit is { entry: SearchEntry; index: number; score: number } => hit.score !== null,
    )
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((hit) => hit.entry)
}
