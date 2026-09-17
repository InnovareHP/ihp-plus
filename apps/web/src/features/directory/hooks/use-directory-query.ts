'use client'

import { queryToHref, searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { DEFAULT_DIRECTORY_QUERY, directoryQuerySchema, type DirectoryQuery } from '../schema'

const MULTI_KEYS = ['teamIds'] as const

export const parseDirectoryQuery = searchParamsParser<DirectoryQuery>(
  directoryQuerySchema,
  MULTI_KEYS,
)

export function directoryQueryHref(pathname: string, query: DirectoryQuery) {
  return queryToHref(pathname, query, DEFAULT_DIRECTORY_QUERY)
}

export function useDirectoryQuery() {
  return useUrlQuery(parseDirectoryQuery, DEFAULT_DIRECTORY_QUERY)
}
