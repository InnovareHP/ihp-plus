import type { DirectoryQuery } from './schema'

export const directoryKeys = {
  all: ['directory'] as const,
  lists: () => [...directoryKeys.all, 'list'] as const,
  list: (query: DirectoryQuery) => [...directoryKeys.lists(), query] as const,
  departments: () => [...directoryKeys.all, 'departments'] as const,
}
