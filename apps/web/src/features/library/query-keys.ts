import type { LibraryQuery } from './schema'

export const libraryKeys = {
  all: ['library'] as const,
  // The folder and its ordering are both server-side, so both belong in the key.
  folder: (query: LibraryQuery) => [...libraryKeys.all, 'folder', query] as const,
}
