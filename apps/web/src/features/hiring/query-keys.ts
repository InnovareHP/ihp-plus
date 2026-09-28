import type { PostingQuery } from './schema'

export const hiringKeys = {
  all: ['hiring'] as const,
  settings: () => [...hiringKeys.all, 'settings'] as const,
  /** Prefix over every cached page, so an optimistic row reaches all of them. */
  postingLists: () => [...hiringKeys.all, 'postings'] as const,
  postings: (query: PostingQuery) => [...hiringKeys.postingLists(), query] as const,
  posting: (postingId: string) => [...hiringKeys.all, 'posting', postingId] as const,
}
