'use client'

import { queryToHref, searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { bluebookQuerySchema, DEFAULT_BLUEBOOK_QUERY, type BluebookQuery } from '../schema'

const MULTI_KEYS = ['categories'] as const

export const parseBluebookQuery = searchParamsParser<BluebookQuery>(bluebookQuerySchema, MULTI_KEYS)

export function bluebookQueryHref(pathname: string, query: BluebookQuery) {
  return queryToHref(pathname, query, DEFAULT_BLUEBOOK_QUERY)
}

export function useBluebookQuery() {
  return useUrlQuery(parseBluebookQuery, DEFAULT_BLUEBOOK_QUERY)
}
