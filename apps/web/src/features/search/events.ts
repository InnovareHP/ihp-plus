import type { EventName } from '@/lib/analytics'

// The query text is never sent: it can hold a person's or a client's name.
export const searchEvents = {
  paletteOpened: 'search.palette.opened',
  resultOpened: 'search.result.opened',
  directoryFailed: 'search.directory.load_failed',
  tasksFailed: 'search.tasks.load_failed',
} as const satisfies Record<string, EventName>
