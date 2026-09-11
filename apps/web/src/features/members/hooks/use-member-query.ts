'use client'

import { queryToHref, searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { DEFAULT_MEMBER_QUERY, memberQuerySchema, type MemberQuery } from '../schema'

// Filters that can hold several values arrive as `?x=a,b` or as repeated params.
const MULTI_KEYS = ['organizationRoles', 'portalRoles', 'employmentTypes', 'teamIds'] as const

export const parseMemberQuery = searchParamsParser<MemberQuery>(memberQuerySchema, MULTI_KEYS)

export function memberQueryHref(pathname: string, query: MemberQuery) {
  return queryToHref(pathname, query, DEFAULT_MEMBER_QUERY)
}

/** The members list reads its page, sort and filters from the URL so both are shareable. */
export function useMemberQuery() {
  return useUrlQuery(parseMemberQuery, DEFAULT_MEMBER_QUERY)
}
