import { z } from 'zod'
import { searchEntrySchema, type SearchEntry } from '../schema'

const PREFIX = 'ihp.search.recent.'
const MAX_RECENT = 5

export const NO_RECENT: readonly SearchEntry[] = []

const listeners = new Set<() => void>()
// useSyncExternalStore needs the same array back until the stored text actually changes.
const snapshots = new Map<string, { raw: string | null; entries: readonly SearchEntry[] }>()

/** One list per person per organization, so a shared computer never shows someone else's. */
export function recentKey(organizationId: string, userId: string) {
  return `${PREFIX}${organizationId}.${userId}`
}

function emit() {
  for (const listener of listeners) listener()
}

// Storage can throw outright in a private window or with site data blocked.
function readRaw(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function parse(raw: string | null): readonly SearchEntry[] {
  if (!raw) return NO_RECENT
  try {
    const parsed = z.array(searchEntrySchema).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data.slice(0, MAX_RECENT) : NO_RECENT
  } catch {
    return NO_RECENT
  }
}

export function readRecent(key: string): readonly SearchEntry[] {
  const raw = readRaw(key)
  const cached = snapshots.get(key)
  if (cached && cached.raw === raw) return cached.entries

  const entries = parse(raw)
  snapshots.set(key, { raw, entries })
  return entries
}

export function rememberRecent(key: string, entry: SearchEntry) {
  const next = [entry, ...readRecent(key).filter((one) => one.id !== entry.id)].slice(0, MAX_RECENT)
  try {
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch {
    return
  }
  emit()
}

export function clearRecentSearches() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(PREFIX)) window.localStorage.removeItem(key)
    }
  } catch {
    return
  }
  emit()
}

export function subscribeRecent(listener: () => void) {
  listeners.add(listener)
  // Another tab of the app writing its own list should show up here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
