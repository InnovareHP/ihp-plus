'use client'

import { queryToHref, searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { clientQuerySchema, DEFAULT_CLIENT_QUERY, type ClientQuery } from '../schema'

const MULTI_KEYS = ['statuses', 'ownerIds', 'states'] as const

export const parseClientQuery = searchParamsParser<ClientQuery>(clientQuerySchema, MULTI_KEYS)

export function clientQueryHref(pathname: string, query: ClientQuery) {
  return queryToHref(pathname, query, DEFAULT_CLIENT_QUERY)
}

export function useClientQuery() {
  return useUrlQuery(parseClientQuery, DEFAULT_CLIENT_QUERY)
}
