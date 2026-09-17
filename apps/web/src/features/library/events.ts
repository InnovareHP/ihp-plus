import type { EventName } from '@/lib/analytics'

export const libraryEvents = {
  browsed: 'library.folder.browsed',
  browseFailed: 'library.folder.browse_failed',
  opened: 'library.file.opened',
  openFailed: 'library.file.open_failed',
} as const satisfies Record<string, EventName>
