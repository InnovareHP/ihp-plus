'use client'

import { Stack } from '@mantine/core'
import { PageSection } from '@/components/page-section'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { DEFAULT_MY_REQUEST_QUERY, myRequestQuerySchema, REQUEST_STATUS_OPTIONS } from '../schema'
import { FormCatalogue } from './form-catalogue'
import { MyRequestsTable } from './my-requests-table'

const parseMyRequestQuery = searchParamsParser(myRequestQuerySchema)

const MY_REQUEST_FILTERS: readonly FilterControl[] = [
  { kind: 'select', key: 'status', label: 'Status', options: REQUEST_STATUS_OPTIONS },
]

export function RequestsPanel({ hasDepartment }: { hasDepartment: boolean }) {
  const { query, setQuery, clearFilters } = useUrlQuery(
    parseMyRequestQuery,
    DEFAULT_MY_REQUEST_QUERY,
  )

  return (
    <>
      <PageSection
        title="Start a request"
        description="Only the forms your department is offered appear here."
      >
        <FormCatalogue hasDepartment={hasDepartment} />
      </PageSection>

      <PageSection
        title="Your requests"
        description="Everything you have sent, and where it got to."
      >
        <Stack gap="md">
          <TableToolbar
            label="your requests"
            query={query}
            setQuery={setQuery}
            clearFilters={clearFilters}
            filters={MY_REQUEST_FILTERS}
          />
          <MyRequestsTable query={query} setQuery={setQuery} clearFilters={clearFilters} />
        </Stack>
      </PageSection>
    </>
  )
}
