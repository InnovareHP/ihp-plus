'use client'

import { Stack } from '@mantine/core'
import { PageSection } from '@/components/page-section'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import {
  DEFAULT_MY_EVALUATION_QUERY,
  EVALUATION_STATUS_OPTIONS,
  myEvaluationQuerySchema,
} from '../schema'
import { MyEvaluationsTable } from './my-evaluations-table'

const parseMyEvaluationQuery = searchParamsParser(myEvaluationQuerySchema)

const MY_EVALUATION_FILTERS: readonly FilterControl[] = [
  { kind: 'select', key: 'status', label: 'Status', options: EVALUATION_STATUS_OPTIONS },
]

export function EvaluationsPanel() {
  const { query, setQuery, clearFilters } = useUrlQuery(
    parseMyEvaluationQuery,
    DEFAULT_MY_EVALUATION_QUERY,
  )

  return (
    <PageSection
      title="People to evaluate"
      description="What you submit is the record — nobody approves it afterwards."
    >
      <Stack gap="md">
        <TableToolbar
          label="your evaluations"
          query={query}
          setQuery={setQuery}
          clearFilters={clearFilters}
          filters={MY_EVALUATION_FILTERS}
        />
        <MyEvaluationsTable query={query} setQuery={setQuery} clearFilters={clearFilters} />
      </Stack>
    </PageSection>
  )
}
