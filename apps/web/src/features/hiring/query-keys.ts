import type { ApplicationQuery, PostingQuery } from './schema'

export const hiringKeys = {
  all: ['hiring'] as const,
  settings: () => [...hiringKeys.all, 'settings'] as const,
  /** Prefix over every cached page, so an optimistic row reaches all of them. */
  postingLists: () => [...hiringKeys.all, 'postings'] as const,
  postings: (query: PostingQuery) => [...hiringKeys.postingLists(), query] as const,
  posting: (postingId: string) => [...hiringKeys.all, 'posting', postingId] as const,
  /** Prefix over every cached list page, so a moved applicant is repainted in all of them. */
  applicationLists: () => [...hiringKeys.all, 'applications'] as const,
  applications: (query: ApplicationQuery) => [...hiringKeys.applicationLists(), query] as const,
  pipelines: () => [...hiringKeys.all, 'pipeline'] as const,
  pipeline: (postingId: string) => [...hiringKeys.pipelines(), postingId] as const,
  application: (applicationId: string) =>
    [...hiringKeys.all, 'application', applicationId] as const,
  interviewers: () => [...hiringKeys.all, 'interviewers'] as const,
  interview: (interviewId: string) => [...hiringKeys.all, 'interview', interviewId] as const,
  suggestions: (key: string) => [...hiringKeys.all, 'suggestions', key] as const,
}
