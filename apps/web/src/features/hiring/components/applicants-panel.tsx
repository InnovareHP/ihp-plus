'use client'

import { MAX_PAGE_SIZE } from '@/lib/pagination'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { usePostings } from '../hooks/use-postings'
import { applicationQuerySchema, DEFAULT_APPLICATION_QUERY, DEFAULT_POSTING_QUERY } from '../schema'
import { ApplicationsTable } from './applications-table'

const parseApplicationQuery = searchParamsParser(applicationQuerySchema)

/** Everyone who applied, across every posting, filtered from the URL. */
export function ApplicantsPanel({ rejectionMessage }: { rejectionMessage: string }) {
  const url = useUrlQuery(parseApplicationQuery, DEFAULT_APPLICATION_QUERY)
  // The posting filter offers the current postings; archived ones are rarely what HR is after.
  const postings = usePostings({ ...DEFAULT_POSTING_QUERY, pageSize: MAX_PAGE_SIZE })

  return (
    <ApplicationsTable
      {...url}
      rejectionMessage={rejectionMessage}
      postingOptions={(postings.data?.rows ?? []).map((posting) => ({
        value: posting.id,
        label: posting.title,
      }))}
    />
  )
}
