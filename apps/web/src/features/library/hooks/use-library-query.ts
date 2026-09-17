'use client'

import { queryToHref, searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { DEFAULT_LIBRARY_QUERY, libraryQuerySchema, type LibraryQuery } from '../schema'

export const parseLibraryQuery = searchParamsParser<LibraryQuery>(libraryQuerySchema, [])

export function libraryHref(pathname: string, query: LibraryQuery) {
  return queryToHref(pathname, query, DEFAULT_LIBRARY_QUERY)
}

export function useLibraryQuery() {
  return useUrlQuery(parseLibraryQuery, DEFAULT_LIBRARY_QUERY)
}
