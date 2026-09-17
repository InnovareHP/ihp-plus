'use client'

import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import {
  DEFAULT_ORGANIZATION_ACCESS_QUERY,
  organizationAccessQuerySchema,
  type OrganizationAccessQuery,
} from '../schema'

export const parseOrganizationAccessQuery = searchParamsParser<OrganizationAccessQuery>(
  organizationAccessQuerySchema,
  [],
)

export function useOrganizationAccessQuery() {
  return useUrlQuery(parseOrganizationAccessQuery, DEFAULT_ORGANIZATION_ACCESS_QUERY)
}
